// Ayudas compartidas por las pruebas: levanta el Worker real dentro de workerd
// (miniflare) con un KV aislado y un push service falso, sin tocar la red.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

// Par VAPID de pruebas, generado con generar-vapid.mjs. No sirve para nada
// fuera del banco de pruebas.
export const VAPID_PRIVADA = '-rnxtggXoKvCfiqBWqgIyBTKL9pwD3vprzXutXAmdKk';
export const VAPID_PUBLICA = 'BGTe8G65euFitzIAXNYTfzpdTByvwxM9Lb1c6tZc3D3etUZOKxw1iZeyF0p0-Cie7G0OBeh7YSdEyls6Kd3GBSI';
export const VAPID_SUBJECT = 'mailto:pruebas@meteosurf.local';
export const ADMIN_TOKEN = 'token-de-pruebas-que-no-sirve-para-nada-1234567890';
export const ORIGEN_WEB = 'https://joorcs96.github.io';
export const AHORA = '2026-10-18T12:00:00Z'; // 14:00 en Madrid

const RUTA_WORKER = fileURLToPath(new URL('../src/index.js', import.meta.url));

/**
 * @param {object} opciones
 * @param {string} [opciones.ahora]  ISO para el binding de pruebas TEST_NOW (hora de Madrid).
 * @param {string} [opciones.kvPersist]  Carpeta para compartir el KV entre instancias.
 * @param {Function} [opciones.push]  Sustituto del push service: (request) => Response.
 */
export async function crearWorker({ ahora = AHORA, kvPersist, push } = {}) {
  const mf = new Miniflare({
    modules: true,
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    modulesRoot: fileURLToPath(new URL('..', import.meta.url)),
    scriptPath: RUTA_WORKER,
    compatibilityDate: '2025-01-01',
    kvNamespaces: { SUBS: 'pruebas' },
    ...(kvPersist ? { kvPersist } : {}),
    bindings: {
      VAPID_PRIVATE: VAPID_PRIVADA,
      VAPID_PUBLIC: VAPID_PUBLICA,
      VAPID_SUBJECT,
      ADMIN_TOKEN,
      TEST_NOW: ahora
    },
    outboundService: push ? (request) => push(request) : (request) => pushServiceFalso(request)
  });
  await mf.ready;
  return mf;
}

/** Push service falso: guarda lo que le llega y responde 201 como los de verdad. */
export function pushServiceFalso(estado = 201) {
  const recibidos = [];
  const fn = async (request) => {
    const cuerpo = new Uint8Array(await request.arrayBuffer());
    recibidos.push({ url: request.url, headers: Object.fromEntries(request.headers.entries()), cuerpo });
    if (estado === 'error-red') throw new Error('sin red en las pruebas');
    return new Response(estado === 201 ? '' : 'motivo', {
      status: estado,
      headers: { 'content-type': 'text/plain' }
    });
  };
  fn.recibidos = recibidos;
  return fn;
}

export async function carpetaTemporaria() {
  return mkdtemp(join(tmpdir(), 'meteosurf-kv-'));
}

export async function borrarCarpeta(dir) {
  await rm(dir, { recursive: true, force: true });
}

/** Peticion JSON al Worker: devuelve {estado, cabeceras, cuerpo}. */
export async function pedir(mf, ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  const init = { method: metodo, headers: { ...cabeceras } };
  if (cuerpo !== undefined) {
    init.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await mf.dispatchFetch(`http://worker.local${ruta}`, init);
  const texto = await res.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  return { estado: res.status, cabeceras: Object.fromEntries(res.headers.entries()), cuerpo: json, texto };
}

export function autorizacion() {
  return { Authorization: `Bearer ${ADMIN_TOKEN}` };
}

/** Suscripcion valida con claves nuevas cada vez que se llama. */
export async function suscripcionFalsa(endpoint = 'https://push.ejemplo.com/x/prueba') {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  return {
    subscription: { endpoint, keys: { p256dh: b64(p256dh), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } },
    privadaUa: par.privateKey,
    publicaUa: p256dh
  };
}

export function b64(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}