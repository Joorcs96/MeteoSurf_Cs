// MeteoSurf · Worker de avisos push
//
// Rutas (JSON):
//   GET  /vapid-public                          -> {"key":"<base64url>"}
//   POST /subscribe    {subscription, prefs}    -> {"id":"<16 hex>"}
//   POST /prefs        {id, prefs}              -> {"ok":true,"prefs":{...}}
//   POST /unsubscribe  {id}                     -> {"ok":true}
//   GET  /subs         (Bearer ADMIN_TOKEN)     -> [{"id","prefs","sentToday","lastByTag"}]
//   POST /notify       (Bearer ADMIN_TOKEN)     -> {"sent":bool,"reason":"cap|quiet|dup|gone|ok|error"}
//
// El motor de avisos (scripts/alertas.py desde GitHub Actions) es quien decide QUE
// aviso toca; aqui solo se aplican los topes duros por suscriptor.

import { base64urlABytes, sha256Hex } from './bytes.js';
import { ahoraMadrid } from './hora.js';
import { cabecerasCors } from './cors.js';
import { sanearPrefs } from './prefs.js';
import { enviarPush } from './push.js';
import {
  PREFIJO_SUBS,
  contarEnvio,
  conDiaActual,
  maximoDelDia,
  puedeEnviar,
  registroNuevo,
  vistaPublica
} from './topes.js';

const MAX_CUERPO = 4096;
const LIMITE_ID = /^[0-9a-f]{16}$/;
// Topic de APNs: 1 a 32 caracteres del alfabeto base64 seguro para URL.
const RE_TOPIC = /^[A-Za-z0-9_-]{1,32}$/;

/** Topic opcional de Safari. Vacio si no viene o si no es valido: mejor sin topic
 *  que con uno equivocado, que haria que Apple tirase el aviso. */
function sanearTopic(valor) {
  if (typeof valor !== 'string') return '';
  const limpio = valor.trim();
  return RE_TOPIC.test(limpio) ? limpio : '';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecerasCors(origin) });
    }

    try {
      if (ruta === '/vapid-public' && request.method === 'GET') return vapidPublic(request, env);
      if (ruta === '/subscribe' && request.method === 'POST') return await suscribir(request, env);
      if (ruta === '/prefs' && request.method === 'POST') return await guardarPrefs(request, env);
      if (ruta === '/unsubscribe' && request.method === 'POST') return await darDeBaja(request, env);
      if (ruta === '/subs' && request.method === 'GET') return await listar(request, env);
      if (ruta === '/notify' && request.method === 'POST') return await avisar(request, env);
      if (RUTAS_CONOCIDAS.has(ruta)) return responder({ error: 'metodo no permitido' }, 405, origin);
      return responder({ error: 'no encontrado' }, 404, origin);
    } catch (error) {
      return responder({ error: 'fallo interno', detalle: String(error && error.message) }, 500, origin);
    }
  }
};

const RUTAS_CONOCIDAS = new Set(['/vapid-public', '/subscribe', '/prefs', '/unsubscribe', '/subs', '/notify']);

// ---------------------------------------------------------------- utilidades

function responder(datos, estado, origin) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cabecerasCors(origin)
    }
  });
}

/** Reloj de Madrid. TEST_NOW solo existe en las pruebas, nunca en produccion. */
function reloj(env) {
  if (typeof env.TEST_NOW === 'string' && env.TEST_NOW) {
    const fecha = new Date(env.TEST_NOW);
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  return new Date();
}

function entornoConReloj(env) {
  return { ...env, ahoraUnix: ahoraMadrid(reloj(env)).unix };
}

async function leerJson(request) {
  const declarado = Number(request.headers.get('Content-Length') || '0');
  if (declarado > MAX_CUERPO) return { error: 'cuerpo demasiado grande', estado: 413 };
  const texto = await request.text();
  if (new TextEncoder().encode(texto).length > MAX_CUERPO) {
    return { error: 'cuerpo demasiado grande', estado: 413 };
  }
  if (!texto.trim()) return { datos: {} };
  try {
    const datos = JSON.parse(texto);
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      return { error: 'el cuerpo debe ser un objeto JSON', estado: 400 };
    }
    return { datos };
  } catch {
    return { error: 'JSON invalido', estado: 400 };
  }
}

function comparacionConstante(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

function autorizado(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const cabecera = request.headers.get('Authorization') || '';
  return comparacionConstante(cabecera, `Bearer ${env.ADMIN_TOKEN}`);
}

async function leerRegistro(env, id) {
  const crudo = await env.SUBS.get(`${PREFIJO_SUBS}${id}`, 'json');
  return crudo && typeof crudo === 'object' ? crudo : null;
}

function problemaDeSuscripcion(subscription) {
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    return 'falta el objeto subscription';
  }
  const endpoint = subscription.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length < 8 || endpoint.length > 512) {
    return 'endpoint no valido';
  }
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return 'endpoint no es una URL';
  }
  if (url.protocol !== 'https:') return 'el endpoint debe ser https';
  const keys = subscription.keys;
  if (!keys || typeof keys !== 'object') return 'falta subscription.keys';
  try {
    if (base64urlABytes(keys.p256dh).length !== 65) return 'p256dh no es un punto P-256 de 65 bytes';
    if (base64urlABytes(keys.auth).length !== 16) return 'auth no tiene 16 bytes';
  } catch {
    return 'las claves no son base64url';
  }
  return null;
}

// --------------------------------------------------------------------- rutas

function vapidPublic(request, env) {
  if (!env.VAPID_PUBLIC) {
    return responder({ error: 'falta el secreto VAPID_PUBLIC' }, 503, request.headers.get('Origin'));
  }
  return responder({ key: env.VAPID_PUBLIC }, 200, request.headers.get('Origin'));
}

async function suscribir(request, env) {
  const origin = request.headers.get('Origin');
  const leido = await leerJson(request);
  if (leido.error) return responder({ error: leido.error }, leido.estado, origin);

  const problema = problemaDeSuscripcion(leido.datos.subscription);
  if (problema) return responder({ error: problema }, 400, origin);

  const { prefs, avisos } = sanearPrefs(leido.datos.prefs);
  const endpoint = leido.datos.subscription.endpoint;
  const id = (await sha256Hex(endpoint)).slice(0, 16);
  const ahora = ahoraMadrid(reloj(env));
  const previo = await leerRegistro(env, id);

  // Una sola suscripcion por endpoint: si ya existe, se actualizan claves y preferencias
  // sin perder el contador del dia ni el historico de tags.
  const registro = registroNuevo(id, endpoint, {
    p256dh: leido.datos.subscription.keys.p256dh,
    auth: leido.datos.subscription.keys.auth
  }, prefs, ahora);
  if (previo) {
    registro.creado = previo.creado;
    registro.dia = previo.dia;
    registro.enviadosHoy = previo.enviadosHoy;
    registro.ultimoPorTag = previo.ultimoPorTag || {};
    registro.topic = previo.topic || '';
  }
  registro.topic = sanearTopic(leido.datos.topic) || registro.topic || '';

  await env.SUBS.put(`${PREFIJO_SUBS}${id}`, JSON.stringify(registro));
  const respuesta = { id, prefs };
  if (avisos.length) respuesta.avisos = avisos;
  return responder(respuesta, 200, origin);
}

async function guardarPrefs(request, env) {
  const origin = request.headers.get('Origin');
  const leido = await leerJson(request);
  if (leido.error) return responder({ error: leido.error }, leido.estado, origin);

  const id = typeof leido.datos.id === 'string' ? leido.datos.id.trim() : '';
  if (!LIMITE_ID.test(id)) return responder({ error: 'id no valido' }, 400, origin);
  const registro = await leerRegistro(env, id);
  if (!registro) return responder({ error: 'suscripcion no encontrada' }, 404, origin);

  const { prefs, avisos } = sanearPrefs(leido.datos.prefs);
  const nuevo = { ...registro, prefs, actualizado: ahoraMadrid(reloj(env)).unix };
  nuevo.topic = sanearTopic(leido.datos.topic) || registro.topic || '';
  await env.SUBS.put(`${PREFIJO_SUBS}${id}`, JSON.stringify(nuevo));
  const respuesta = { ok: true, prefs };
  if (avisos.length) respuesta.avisos = avisos;
  return responder(respuesta, 200, origin);
}

async function darDeBaja(request, env) {
  const origin = request.headers.get('Origin');
  const leido = await leerJson(request);
  if (leido.error) return responder({ error: leido.error }, leido.estado, origin);

  const id = typeof leido.datos.id === 'string' ? leido.datos.id.trim() : '';
  if (!LIMITE_ID.test(id)) return responder({ error: 'id no valido' }, 400, origin);
  await env.SUBS.delete(`${PREFIJO_SUBS}${id}`);
  return responder({ ok: true }, 200, origin);
}

async function listar(request, env) {
  const origin = request.headers.get('Origin');
  if (!autorizado(request, env)) return responder({ error: 'no autorizado' }, 401, origin);

  const ahora = ahoraMadrid(reloj(env));
  const lista = [];
  let cursor;
  do {
    const pagina = await env.SUBS.list({ prefix: PREFIJO_SUBS, cursor, limit: 1000 });
    for (const clave of pagina.keys || []) {
      const registro = await leerRegistro(env, clave.name.slice(PREFIJO_SUBS.length));
      if (registro) lista.push(vistaPublica(registro, ahora));
    }
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);

  return responder(lista, 200, origin);
}

async function avisar(request, env) {
  const origin = request.headers.get('Origin');
  if (!autorizado(request, env)) return responder({ sent: false, reason: 'no autorizado' }, 401, origin);

  const leido = await leerJson(request);
  if (leido.error) return responder({ sent: false, reason: 'error', detalle: leido.error }, leido.estado, origin);

  const datos = leido.datos;
  const id = typeof datos.id === 'string' ? datos.id.trim() : '';
  if (!LIMITE_ID.test(id)) {
    return responder({ sent: false, reason: 'error', detalle: 'id no valido' }, 400, origin);
  }
  if (typeof datos.title !== 'string' || !datos.title.trim()) {
    return responder({ sent: false, reason: 'error', detalle: 'falta title' }, 400, origin);
  }
  const titulo = datos.title.slice(0, 80);
  const cuerpo = typeof datos.body === 'string' ? datos.body.slice(0, 200) : '';
  const destino = typeof datos.url === 'string' ? datos.url.slice(0, 300) : '/';
  const tag = typeof datos.tag === 'string' ? datos.tag.slice(0, 120) : '';

  const registro = await leerRegistro(env, id);
  if (!registro) return responder({ sent: false, reason: 'gone' }, 200, origin);

  const ahora = ahoraMadrid(reloj(env));
  const decision = puedeEnviar(registro, registro.prefs, tag, ahora);
  const registroHoy = conDiaActual(registro, ahora);
  const limite = maximoDelDia(registro.prefs);
  if (!decision.ok) {
    return responder(
      { sent: false, reason: decision.motivo, sentToday: registroHoy.enviadosHoy, maxPerDay: limite },
      200,
      origin
    );
  }

  const texto = JSON.stringify({ title: titulo, body: cuerpo, url: destino, tag });
  const resultado = await enviarPush({
    endpoint: registro.endpoint,
    subscription: { endpoint: registro.endpoint, keys: registro.keys },
    texto,
    topic: registro.topic,
    env: entornoConReloj(env)
  });

  if (!resultado.ok && resultado.motivo === 'gone') {
    // 404/410: el navegador se dio de baja. Se limpia y no se molesta mas.
    await env.SUBS.delete(`${PREFIJO_SUBS}${id}`);
    return responder({ sent: false, reason: 'gone' }, 200, origin);
  }

  if (!resultado.ok) {
    // No se cuenta como enviado: asi un fallo puntual del push service no quema el dia.
    return responder(
      { sent: false, reason: 'error', detalle: resultado.detalle || `HTTP ${resultado.estado}` },
      200,
      origin
    );
  }

  const actualizado = contarEnvio(registro, tag, ahora);
  await env.SUBS.put(`${PREFIJO_SUBS}${id}`, JSON.stringify(actualizado));
  return responder({ sent: true, reason: 'ok', sentToday: actualizado.enviadosHoy, maxPerDay: limite }, 200, origin);
}