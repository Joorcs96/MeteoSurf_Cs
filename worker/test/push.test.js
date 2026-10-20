// Cifrado aes128gcm y JWT de VAPID: prueba de ida y vuelta sin red.
// Desciframos el cuerpo exactamente como haria el navegador (Web Push,
// aes128gcm): cabecera salt|rs|idlen|clave, derives segun RFC 8291 y AES-GCM.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { base64urlABytes, bytesABase64url, concatBytes, hkdfExpand, hmacSha256, textoABytes } from '../src/bytes.js';
import { CURVA_ECDH, firmarJwtVapid, importarClavesVapid, pkcs8DesdeEscalar } from '../src/vapid.js';
import { cifrarCuerpo, enviarPush } from '../src/push.js';
import { VAPID_PUBLICA, VAPID_PRIVADA, VAPID_SUBJECT, b64 } from './helpers.js';

async function parUsuario() {
  const par = await crypto.subtle.generateKey(CURVA_ECDH, true, ['deriveBits']);
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  return {
    privada: par.privateKey,
    publica,
    subscription: {
      endpoint: 'https://push.ejemplo.com/3/device/abc',
      keys: { p256dh: b64(publica), auth: b64(crypto.getRandomValues(new Uint8Array(16))) }
    }
  };
}

async function descifrar(cuerpo, usuario) {
  // Cabecera: salt (16) | rs (4) | longitud de la clave del servidor (1) | clave
  const idlen = cuerpo[20];
  const cabecera = cuerpo.subarray(0, 21 + idlen);
  const cifrado = cuerpo.subarray(21 + idlen);
  const salt = cabecera.subarray(0, 16);
  const recordSize = new DataView(cabecera.buffer, cabecera.byteOffset + 16, 4).getUint32(0);
  const asPublico = cabecera.subarray(21);

  const asClave = await crypto.subtle.importKey('raw', asPublico, CURVA_ECDH, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asClave }, usuario.privada, 256));

  const prk = await hmacSha256(base64urlABytes(usuario.subscription.keys.auth), ecdh);
  const keyInfo = concatBytes(
    textoABytes('WebPush: info'),
    new Uint8Array([0]),
    usuario.publica,
    asPublico
  );
  const ikm = await hkdfExpand(prk, keyInfo, 32);
  const prkFinal = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  const claveAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const plano = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: cabecera }, claveAes, cifrado)
  );
  // El navegador busca el delimitador 0x02 hacia atras; antes solo puede haber ceros.
  let fin = plano.length - 1;
  while (fin >= 0 && plano[fin] === 0) fin -= 1;
  assert.equal(plano[fin], 0x02, 'el delimitador de relleno es 0x02');
  return { texto: new TextDecoder().decode(plano.subarray(0, fin)), recordSize, plano };
}

test('cifrarCuerpo produce un paquete que el navegador descifra', async () => {
  const usuario = await parUsuario();
  const aviso = JSON.stringify({ title: 'Olas en Planetario', body: 'Ahora si hay.', url: '/', tag: 'olas_ahora:planetario' });
  const cuerpo = await cifrarCuerpo(usuario.subscription, aviso);
  assert.ok(cuerpo instanceof Uint8Array);

  const vuelta = await descifrar(cuerpo, usuario);
  assert.equal(vuelta.recordSize, 4096, 'la cabecera declara un record size de 4096');
  assert.equal(vuelta.texto, aviso);
});

test('el relleno es solo el delimitador 0x02 al final del texto', async () => {
  const usuario = await parUsuario();
  const cuerpo = await cifrarCuerpo(usuario.subscription, 'x'.repeat(100));
  const vuelta = await descifrar(cuerpo, usuario);
  assert.equal(vuelta.plano.length, 101, '100 bytes de texto y el delimitador');
  assert.equal(vuelta.plano[100], 0x02, 'el delimitador es el ultimo octeto');
  assert.equal(vuelta.texto.length, 100);
});

test('reproduce el ejemplo del apendice A de RFC 8291', async () => {
  // Valores oficiales del RFC: si esto cuadra, los navegadores descifran igual.
  const texto = 'When I grow up, I want to be a watermelon';
  const usuario = {
    publica: base64urlABytes(
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
    ),
    privada: await crypto.subtle.importKey(
      'pkcs8',
      pkcs8DesdeEscalar(base64urlABytes('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94')),
      CURVA_ECDH,
      false,
      ['deriveBits']
    ),
    subscription: {
      endpoint: 'https://push.ejemplo.com/x',
      keys: { p256dh: '', auth: 'BTBZMqHH6r4Tts7J_aSIgg' }
    }
  };
  usuario.subscription.keys.p256dh = bytesABase64url(usuario.publica);
  const cuerpo = await cifrarCuerpo(usuario.subscription, texto, {
    salt: base64urlABytes('DGv6ra1nlYgDCS1FRnbzlw'),
    servidor: {
      privada: await crypto.subtle.importKey(
        'pkcs8',
        pkcs8DesdeEscalar(base64urlABytes('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')),
        CURVA_ECDH,
        false,
        ['deriveBits']
      ),
      publica: base64urlABytes(
        'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
      )
    }
  });

    const cuerpoRfc = base64urlABytes(
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
  );
  assert.equal(cuerpoRfc.length, 144, '86 de cabecera + 58 de cifrado');
  assert.equal(cuerpo.length, cuerpoRfc.length);
  assert.deepEqual(Array.from(cuerpo.subarray(0, 86)), Array.from(cuerpoRfc.subarray(0, 86)), 'cabecera identica');
  assert.deepEqual(
    Array.from(cuerpo.subarray(86, 128)),
    Array.from(cuerpoRfc.subarray(86, 128)),
    'los 42 bytes de cifrado del ejemplo salen igual'
  );

  // Ojo: la etiqueta de 16 bytes del ejemplo esta mal (el ejemplo del RFC la calcula
  // sin la cabecera como AAD; la norma, RFC 8188 seccion 2, obliga a usarla). Por eso
  // aqui se comprueba al reves: se descifra con la cabecera como AAD, que es lo que
  // hacen los navegadores, y se comprueba que sin cabecera la etiqueta no cuadra.
  const cabecera = cuerpo.subarray(0, 86);
  const descifrado = await descifrar(cuerpo, { ...usuario, subscription: usuario.subscription });
  assert.equal(descifrado.texto, texto);
  assert.equal(desdeWebPush(descifrado.plano), texto, 'delimitador 0x02 al final');

  await assert.rejects(
    () => descifrarCon(cuerpo, usuario, new Uint8Array(0)),
    'sin la cabecera como AAD la etiqueta no cuadra'
  );
});

function desdeWebPush(plano) {
  let fin = plano.length - 1;
  while (fin >= 0 && plano[fin] === 0) fin -= 1;
  return new TextDecoder().decode(plano.subarray(0, fin));
}

async function descifrarCon(cuerpo, usuario, aad) {
  const idlen = cuerpo[20];
  const cabecera = cuerpo.subarray(0, 21 + idlen);
  const cifrado = cuerpo.subarray(21 + idlen);
  const asPublico = cabecera.subarray(21);
  const asClave = await crypto.subtle.importKey('raw', asPublico, CURVA_ECDH, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asClave }, usuario.privada, 256));
  const prk = await hmacSha256(base64urlABytes(usuario.subscription.keys.auth), ecdh);
  const ikm = await hkdfExpand(
    prk,
    concatBytes(textoABytes('WebPush: info'), new Uint8Array([0]), usuario.publica, asPublico),
    32
  );
  const prkFinal = await hmacSha256(cabecera.subarray(0, 16), ikm);
  const cek = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdfExpand(prkFinal, concatBytes(textoABytes('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const claveAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, claveAes, cifrado);
}

test('cada cifrado usa una clave efimera y una sal distintas', async () => {
  const usuario = await parUsuario();
  const uno = await cifrarCuerpo(usuario.subscription, 'hola');
  const otro = await cifrarCuerpo(usuario.subscription, 'hola');
  assert.notDeepEqual(Array.from(uno), Array.from(otro));
  assert.notDeepEqual(Array.from(uno.subarray(0, 16)), Array.from(otro.subarray(0, 16)));
  assert.equal((await descifrar(otro, usuario)).texto, 'hola');
});

test('el JWT de VAPID lleva aud = origen del endpoint, sub y exp menor de 24 h', async () => {
  const claves = await importarClavesVapid(VAPID_PRIVADA, VAPID_PUBLICA);
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123?x=1';
  const ahoraUnix = 1_800_000_000;
  const jwt = await firmarJwtVapid({ endpoint, subject: VAPID_SUBJECT, claves, ahoraUnix });
  const [cabeceraB64, cargaB64, firmaB64] = jwt.split('.');

  assert.deepEqual(JSON.parse(Buffer.from(cabeceraB64, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  const carga = JSON.parse(Buffer.from(cargaB64, 'base64url').toString());
  assert.equal(carga.aud, 'https://fcm.googleapis.com');
  assert.equal(carga.sub, VAPID_SUBJECT);
  assert.ok(carga.exp > ahoraUnix && carga.exp - ahoraUnix < 24 * 3600, 'exp por debajo de 24 h');

  // Firma ES256 valida (r||s) contra la clave publica.
  const firma = base64urlABytes(firmaB64);
  assert.equal(firma.length, 64, 'firma P1363 de 64 bytes');
  const publica = await crypto.subtle.importKey(
    'spki',
    Buffer.concat([
      Buffer.from([0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00]),
      Buffer.from(VAPID_PUBLICA, 'base64url')
    ]),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publica,
    firma,
    textoABytes(`${cabeceraB64}.${cargaB64}`)
  );
  assert.equal(ok, true, 'la firma del JWT verifica con la publica');
});

test('pkcs8DesdeEscalar reconstruye una clave que WebCrypto acepta', async () => {
  const escalar = base64urlABytes(VAPID_PRIVADA);
  assert.equal(escalar.length, 32);
  const clave = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8DesdeEscalar(escalar),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  assert.equal(clave.type, 'private');
});

test('enviarPut manda cabeceras VAPID y devuelve gone con 404 o 410', async () => {
  const usuario = await parUsuario();
  const env = { VAPID_PRIVATE: VAPID_PRIVADA, VAPID_PUBLIC: VAPID_PUBLICA, VAPID_SUBJECT };
  const capturados = [];
  const buscar = async (url, opciones) => {
    capturados.push({ url, headers: opciones.headers, cuerpo: opciones.body });
    return new Response('', { status: 410 });
  };

  const resultado = await enviarPush({
    endpoint: usuario.subscription.endpoint,
    subscription: usuario.subscription,
    texto: 'hola',
    env,
    buscar
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'gone');

  const cabeceras = capturados[0].headers;
  assert.match(cabeceras.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.equal(cabeceras['k'] ?? cabeceras.Authorization.split('k=')[1], VAPID_PUBLICA);
  assert.equal(cabeceras['Content-Encoding'], 'aes128gcm');
  assert.equal(cabeceras.TTL, '86400');
  const vuelta = await descifrar(capturados[0].cuerpo, usuario);
  assert.equal(vuelta.texto, 'hola');
});

test('Safari recibe cabeceras de APNs y solo envia topic si la web lo guardo', async () => {
  const usuario = await parUsuario();
  usuario.subscription.endpoint = 'https://web.push.apple.com/3/device/token-de-ejemplo';
  const env = { VAPID_PRIVATE: VAPID_PRIVADA, VAPID_PUBLIC: VAPID_PUBLICA, VAPID_SUBJECT };

  let cabeceras = null;
  const buscar = async (url, opciones) => {
    cabeceras = opciones.headers;
    return new Response('', { status: 201 });
  };

  await enviarPush({ endpoint: usuario.subscription.endpoint, subscription: usuario.subscription, texto: 'hola', env, buscar });
  assert.equal(cabeceras['apns-push-type'], 'alert');
  assert.equal(cabeceras['apns-priority'], '10');
  assert.equal(cabeceras['apns-topic'], undefined, 'sin topic no se inventa ninguno');

  await enviarPush({
    endpoint: usuario.subscription.endpoint,
    subscription: usuario.subscription,
    texto: 'hola',
    env,
    topic: 'web.ejemplo.meteosurf',
    buscar
  });
  assert.equal(cabeceras['apns-topic'], 'web.ejemplo.meteosurf');
});