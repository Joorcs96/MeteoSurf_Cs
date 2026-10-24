// Web Push con cifrado aes128gcm (RFC 8291) sobre WebCrypto.
// Los push services de Chrome, Firefox, Edge y Safari (iOS 16.4+) aceptan esto
// tal cual, asi que no hace falta ninguna libreria de Node.

import { base64urlABytes, concatBytes, hkdfExpand, hmacSha256, textoABytes } from './bytes.js';
import { firmarJwtVapid, importarClavesVapid, CURVA_ECDH } from './vapid.js';

const MAX_PLAINO = 3000; // con delimitador, relleno y etiqueta AEAD todo cabe en un registro de 4096

/**
 * Cifra el cuerpo y devuelve los bytes exactos que se envian al push service.
 * `opciones.salt` y `opciones.servidor` solo se usan en las pruebas, para poder
 * reproducir el ejemplo del apendice A de RFC 8291.
 */
export async function cifrarCuerpo(subscription, texto, opciones = {}) {
  const plano = textoABytes(texto);
  if (plano.length > MAX_PLAINO) {
    throw new Error(`el aviso ocupa ${plano.length} bytes y el maximo es ${MAX_PLAINO}`);
  }
  const delNavegador = subscription && subscription.keys ? subscription.keys : subscription;
  const uaPublico = base64urlABytes(delNavegador.p256dh);
  const secretoAuth = base64urlABytes(delNavegador.auth);
  if (uaPublico.length !== 65 || uaPublico[0] !== 0x04) {
    throw new Error('p256dh no es un punto P-256 valido');
  }
  if (secretoAuth.length !== 16) {
    throw new Error('auth no tiene 16 bytes');
  }

  const servidor = opciones.servidor || (await clavesServidor());
  const asPublico = servidor.publica;
  const uaClave = await crypto.subtle.importKey('raw', uaPublico, CURVA_ECDH, false, []);
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaClave }, servidor.privada, 256)
  );

  const salt = opciones.salt || crypto.getRandomValues(new Uint8Array(16));

  // IKM = HKDF(auth, ecdh, key_info, 32)
  const prk = await hmacSha256(secretoAuth, ecdh);
  const keyInfo = concatBytes(textoABytes('WebPush: info'), new Uint8Array([0]), uaPublico, asPublico);
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  // PRK = HKDF(salt, IKM, cek_info || nonce_info, 32)
  const prkFinal = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  // Cabecera: salt | rs (4096 en big endian) | longitud de la clave del servidor | clave
  const cabecera = concatBytes(
    salt,
    new Uint8Array([0x00, 0x00, 0x10, 0x00]),
    new Uint8Array([asPublico.length]),
    asPublico
  );

  // Relleno de aes128gcm: el texto seguido del delimitador 0x02, tal cual aparece en
  // el ejemplo del apendice A de RFC 8291. El delimitador es obligatorio (seccion 4:
  // si el ultimo octeto no es 0x02 el navegador descarta el mensaje) y no se anaden
  // ceros por delante, que es lo que hacen las implementaciones de referencia.
  const planoRelleno = new Uint8Array(plano.length + 1);
  planoRelleno.set(plano);
  planoRelleno[plano.length] = 0x02;

  const claveAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: cabecera }, claveAes, planoRelleno)
  );

  return concatBytes(cabecera, cifrado);
}

/** Par ECDH efimero del servidor: caduca en cuanto sale el push. */
export async function clavesServidor() {
  const claves = await crypto.subtle.generateKey(CURVA_ECDH, true, ['deriveBits']);
  return {
    privada: claves.privateKey,
    publica: new Uint8Array(await crypto.subtle.exportKey('raw', claves.publicKey))
  };
}

/**
 * Safari (APNs) pide cabeceras propias. El topic NO se adivina: si se manda uno
 * equivocado Apple responde 400 BadWebPushTopic y el iPhone no recibe nada, asi que
 * solo se manda el que la web haya guardado en la suscripcion (opcional).
 */
function cabecerasApple(topic) {
  const cabeceras = { 'apns-push-type': 'alert', 'apns-priority': '10' };
  if (topic) cabeceras['apns-topic'] = topic;
  return cabeceras;
}

/**
 * Envia un aviso. Devuelve {ok, estado, motivo} sin lanzar: quien decide es index.js,
 * que ademas necesita distinguir 404/410 (suscripcion borrada) del resto.
 */
export async function enviarPush({ endpoint, subscription, texto, env, topic, buscar = fetch }) {
  let claves;
  try {
    claves = await importarClavesVapid(env.VAPID_PRIVATE, env.VAPID_PUBLIC);
  } catch (error) {
    return { ok: false, estado: 0, motivo: 'error', detalle: `claves VAPID: ${error.message}` };
  }

  let jwt;
  try {
    jwt = await firmarJwtVapid({ endpoint, subject: env.VAPID_SUBJECT, claves, ahoraUnix: env.ahoraUnix });
  } catch (error) {
    return { ok: false, estado: 0, motivo: 'error', detalle: `jwt VAPID: ${error.message}` };
  }

  let cuerpo;
  try {
    cuerpo = await cifrarCuerpo(subscription, texto);
  } catch (error) {
    return { ok: false, estado: 0, motivo: 'error', detalle: `cifrado: ${error.message}` };
  }

  const cabeceras = {
    Authorization: `vapid t=${jwt}, k=${claves.publicaB64}`,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: '86400',
    Urgency: 'normal'
  };
  if (endpoint.includes('push.apple.com')) Object.assign(cabeceras, cabecerasApple(topic));

  try {
    const res = await buscar(endpoint, { method: 'POST', headers: cabeceras, body: cuerpo });
    const estado = res.status;
    if (estado >= 200 && estado < 300) return { ok: true, estado, motivo: 'ok' };
    if (estado === 404 || estado === 410) return { ok: false, estado, motivo: 'gone' };
    return { ok: false, estado, motivo: 'error', detalle: await textoCorto(res) };
  } catch (error) {
    return { ok: false, estado: 0, motivo: 'error', detalle: `red: ${error.message}` };
  }
}

async function textoCorto(res) {
  try {
    const t = await res.text();
    return t.slice(0, 120);
  } catch {
    return '';
  }
}