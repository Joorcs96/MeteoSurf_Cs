// VAPID (RFC 8292) con WebCrypto puro: nada de librerias de Node.
//
// La clave privada se guarda como escalar P-256 en base64url, y la publica como
// el punto sin comprimir (65 bytes, 0x04 || X || Y) tambien en base64url, que es
// justo lo que la web envia en applicationServerKey.

import { base64urlABytes, bytesABase64url, concatBytes, textoABytes } from './bytes.js';

const CURVA = { name: 'ECDSA', namedCurve: 'P-256' };
const CURVA_ECDH = { name: 'ECDH', namedCurve: 'P-256' };

// PKCS#8 de P-256: SEQUENCE { INTEGER 0, AlgorithmIdentifier,
//                              OCTET STRING { SEQUENCE { INTEGER 1, OCTET STRING } } }
const PREFIJO_PKCS8 = new Uint8Array([
  0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
  0x01, 0x04, 0x20
]);

// SubjectIdentifier de P-256 (65537) y prefixo del OID ecPublicKey / prime256v1.
const PREFIJO_SPKI = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
  0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
]);

export function pkcs8DesdeEscalar(escalar) {
  if (escalar.length !== 32) throw new Error('la clave privada VAPID debe tener 32 bytes');
  return concatBytes(PREFIJO_PKCS8, escalar);
}

export function spkiDesdePunto(punto) {
  if (punto.length !== 65 || punto[0] !== 0x04) {
    throw new Error('la clave publica VAPID debe ser el punto P-256 sin comprimir (65 bytes)');
  }
  return concatBytes(PREFIJO_SPKI, punto);
}

export async function importarClavesVapid(privadaB64, publicaB64) {
  const escalar = base64urlABytes(privadaB64);
  const punto = base64urlABytes(publicaB64);
  const privada = await crypto.subtle.importKey('pkcs8', pkcs8DesdeEscalar(escalar), CURVA, false, ['sign']);
  await crypto.subtle.importKey('spki', spkiDesdePunto(punto), CURVA, true, ['verify']);
  return { privada, publicaB64: bytesABase64url(punto) };
}

export function esSubjectValido(subject) {
  return typeof subject === 'string' && (subject.startsWith('mailto:') || subject.startsWith('https://'));
}

/**
 * JWT ES256 de VAPID. aud = origen del endpoint, sub = mailto: o https:,
 * exp = 12 h (el contrato pide menos de 24 h).
 */
export async function firmarJwtVapid({ endpoint, subject, claves, segundosValidez = 12 * 3600, ahoraUnix }) {
  if (!esSubjectValido(subject)) throw new Error('VAPID_SUBJECT debe empezar por mailto: o https://');
  let aud;
  try {
    aud = new URL(endpoint).origin;
  } catch {
    throw new Error('endpoint de suscripcion no valido');
  }
  const ahora = typeof ahoraUnix === 'number' ? ahoraUnix : Math.floor(Date.now() / 1000);
  const cabecera = { typ: 'JWT', alg: 'ES256' };
  const carga = {
    aud,
    exp: ahora + Math.min(segundosValidez, 23 * 3600),
    sub: subject
  };
  const parteFirme = `${bytesABase64url(textoABytes(JSON.stringify(cabecera)))}.${bytesABase64url(
    textoABytes(JSON.stringify(carga))
  )}`;
  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    claves.privada,
    textoABytes(parteFirme)
  );
  // WebCrypto devuelve la firma en bruto r||s (P1363), que es lo que pide JWS ES256.
  return `${parteFirme}.${bytesABase64url(new Uint8Array(firma))}`;
}

export { CURVA_ECDH };