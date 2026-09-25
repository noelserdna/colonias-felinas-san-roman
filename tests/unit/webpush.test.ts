import { describe, expect, it } from "vitest";
import { b64url, encryptPayload, fromB64url, vapidAuthorization } from "../../src/lib/webpush";

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

/** Descifra como lo haría el navegador (RFC 8291), para comprobar el cifrado de extremo a extremo. */
async function decryptAsBrowser(body: Uint8Array, ua: CryptoKeyPair, uaPublic: Uint8Array, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, secret, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  expect(plain[plain.length - 1]).toBe(2); // delimitador de último registro
  return { rs, idlen, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

describe("Web Push", () => {
  it("cifra el mensaje de forma que el navegador lo puede descifrar (aes128gcm)", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const mensaje = JSON.stringify({ title: "Tu colonia ya está registrada", body: "Colonia «Polideportivo» (n.º 7)", url: "/colonia/abc" });
    const body = await encryptPayload({ p256dh: b64url(uaPublic), auth: b64url(auth) }, enc.encode(mensaje));
    const r = await decryptAsBrowser(body, ua, uaPublic, auth);
    expect(r.text).toBe(mensaje);
    expect(r.rs).toBe(4096);
    expect(r.idlen).toBe(65);
  });

  it("firma la cabecera VAPID con ES256 para el origen del servicio de push", async () => {
    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const publicKey = b64url(await crypto.subtle.exportKey("raw", kp.publicKey));
    const privateJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const now = Date.UTC(2026, 8, 25);
    const h = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/xyz", { publicKey, privateJwk, subject: "https://sanroman.colonia.dev" }, now);
    const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(m[4]).toBe(publicKey);
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(m[2])));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: now / 1000 + 12 * 3600, sub: "https://sanroman.colonia.dev" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, fromB64url(m[3]), enc.encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
});

import { isPushEndpoint } from "../../src/lib/push-endpoint";

describe("servicios de push admitidos", () => {
  it("acepta los de Google, Apple, Mozilla y Microsoft", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://web.push.apple.com/QGh…",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ])
      expect(isPushEndpoint(e), e).toBe(true);
  });
  it("rechaza cualquier otra dirección (evita SSRF)", () => {
    for (const e of ["http://fcm.googleapis.com/x", "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com.evil.example/x", "https://169.254.169.254/latest", "https://localhost/x", "javascript:alert(1)"])
      expect(isPushEndpoint(e), e).toBe(false);
  });
});
