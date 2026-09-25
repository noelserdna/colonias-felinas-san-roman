// Genera un par de claves VAPID para las notificaciones push.
// Uso: node scripts/vapid-keys.mjs > claves.json   → { publicKey (base64url), privateJwk }
// La pública va en VAPID_PUBLIC_KEY (wrangler.jsonc); la privada, como JSON, en el secreto VAPID_PRIVATE_KEY.
const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
const publicKey = Buffer.from(raw).toString("base64url");
const { kty, crv, x, y, d } = await crypto.subtle.exportKey("jwk", kp.privateKey);
console.log(JSON.stringify({ publicKey, privateJwk: { kty, crv, x, y, d } }));
