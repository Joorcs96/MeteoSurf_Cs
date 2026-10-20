// Conversiones base64url <-> bytes con WebCrypto (sin Buffer, para que corra en Workers).

export function bytesABase64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const troceado = 0x8000;
  for (let i = 0; i < b.length; i += troceado) {
    bin += String.fromCharCode.apply(null, b.subarray(i, i + troceado));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlABytes(texto) {
  const limpio = String(texto).trim().replace(/-/g, '+').replace(/_/g, '/');
  const relleno = limpio.length % 4 === 0 ? '' : '='.repeat(4 - (limpio.length % 4));
  const bin = atob(limpio + relleno);
  const salida = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) salida[i] = bin.charCodeAt(i);
  return salida;
}

export function bytesABase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const troceado = 0x8000;
  for (let i = 0; i < b.length; i += troceado) {
    bin += String.fromCharCode.apply(null, b.subarray(i, i + troceado));
  }
  return btoa(bin);
}

export function concatBytes(...listas) {
  const total = listas.reduce((n, l) => n + l.length, 0);
  const salida = new Uint8Array(total);
  let off = 0;
  for (const l of listas) {
    salida.set(l instanceof Uint8Array ? l : new Uint8Array(l), off);
    off += l.length;
  }
  return salida;
}

export function textoABytes(texto) {
  return new TextEncoder().encode(texto);
}

// SHA-256 en hexadecimal.
export async function sha256Hex(texto) {
  const dig = await crypto.subtle.digest('SHA-256', textoABytes(texto));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA-256: importamos la clave cada vez; el coste es irrelevante a este tamaño.
export async function hmacSha256(clave, datos) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    clave,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', cryptoKey, datos);
  return new Uint8Array(firma);
}

// HKDF-Expand con SHA-256, tal y como lo describe RFC 8291 (informacion de un solo bloque).
export async function hkdfExpand(prk, info, largo) {
  const bloque = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return bloque.slice(0, largo);
}