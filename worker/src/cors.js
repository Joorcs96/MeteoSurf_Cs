// CORS estricto: solo la web publicada y las pruebas locales de escritorio.
// Cualquier otro origen recibe la respuesta pero sin cabeceras de permiso,
// asi que el navegador la bloquea.

export const ORIGEN_PERMITIDO = 'https://joorcs96.github.io';

export function origenPermitido(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === ORIGEN_PERMITIDO) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:') return false;
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function cabecerasCors(origin, metodos = 'GET,POST,OPTIONS') {
  if (!origenPermitido(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': metodos,
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}