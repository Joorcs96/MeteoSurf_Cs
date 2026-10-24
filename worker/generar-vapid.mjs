// Genera el par de claves VAPID del Worker. No guarda nada: lo imprime para
// que se copie a los secretos de Cloudflare con `npx wrangler secret put`.
//
//   node generar-vapid.mjs
//
// VAPID_PUBLIC es la que va en js/config.js de la web (applicationServerKey);
// VAPID_PRIVATE no sale de la consola de Cloudflare nunca.

import { createPrivateKey, randomBytes } from 'node:crypto';

const P256 = { name: 'ECDSA', namedCurve: 'P-256' };

function base64url(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const par = await crypto.subtle.generateKey(P256, true, ['sign', 'verify']);
const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
// El escalar privado no es el final del PKCS#8 (alli acaba la clave publica), asi que
// se le pide a Node que lo saque por JWK.
const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', par.privateKey));
const jwk = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }).export({ format: 'jwk' });
const privada = Buffer.from(jwk.d, 'base64url');

console.log('');
console.log('VAPID_PUBLIC  (applicationServerKey, va en js/config.js de la web)');
console.log(base64url(publica));
console.log('');
console.log('VAPID_PRIVATE (nunca al repo, nunca al navegador)');
console.log(base64url(privada));
console.log('');
console.log('ADMIN_TOKEN sugerido (ponlo largo y aleatorio)');
console.log(base64url(randomBytes(32)));
console.log('');
console.log('VAPID_SUBJECT: mailto:correo@dominio.com');
console.log('');
console.log('Ahora, en la carpeta worker:');
console.log('  npx wrangler secret put VAPID_PUBLIC');
console.log('  npx wrangler secret put VAPID_PRIVATE');
console.log('  npx wrangler secret put VAPID_SUBJECT');
console.log('  npx wrangler secret put ADMIN_TOKEN');