// Web Push sin dependencias, solo con WebCrypto (funciona en Cloudflare Workers y en Node):
// - cifrado del mensaje «aes128gcm» (RFC 8291 y RFC 8188);
// - autenticación del servidor con VAPID (RFC 8292): JWT firmado con ES256.

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateJwk: JsonWebKey; subject: string };

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

/** HKDF-SHA256 (extracción y expansión en un paso). */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

/**
 * Cifra el mensaje para una suscripción (RFC 8291). Devuelve el cuerpo listo para enviar con
 * `Content-Encoding: aes128gcm`: cabecera (sal, tamaño de registro, clave pública efímera) + texto cifrado.
 */
export async function encryptPayload(sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  const ua = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const as = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, as.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Un único registro: el mensaje seguido del delimitador 0x02 (último registro, sin relleno).
  const plain = concat(payload, new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, key, plain as BufferSource));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** Cabecera Authorization de VAPID para el servicio de push del endpoint (válida 12 horas). */
export async function vapidAuthorization(endpoint: string, vapid: Vapid, now = Date.now()): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto firma ECDSA en formato r||s (64 bytes), que es justo el que usa JWS.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${vapid.publicKey}`;
}

export type PushResult = { ok: boolean; status: number; gone: boolean };

/** Envía un mensaje a una suscripción. `gone` indica que la suscripción ya no existe y hay que borrarla. */
export async function sendPush(sub: PushSubscriptionKeys, message: unknown, vapid: Vapid, opts: { ttl?: number; urgency?: "low" | "normal" | "high"; topic?: string } = {}): Promise<PushResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttl ?? 4 * 86_400),
      Urgency: opts.urgency ?? "normal",
      ...(opts.topic ? { Topic: opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
    },
    body: body as BodyInit,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
