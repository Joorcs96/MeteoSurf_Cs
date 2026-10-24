// El Worker completo dentro de workerd (miniflare), sin red: el unico fetch
// que sale es al push service, y ese lo sustituimos por un doble.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_TOKEN,
  ORIGEN_WEB,
  VAPID_PUBLICA,
  autorizacion,
  borrarCarpeta,
  carpetaTemporaria,
  crearWorker,
  pedir,
  pushServiceFalso,
  suscripcionFalsa
} from './helpers.js';

const AVISO = {
  title: 'Olas ahora en Planetario',
  body: 'Tres estrellas con poco viento.',
  url: '/?spot=planetario',
  tag: 'olas_ahora:planetario:2026-10-18'
};

let mf;
let push;

before(async () => {
  push = pushServiceFalso(201);
  mf = await crearWorker({ push });
});

after(async () => {
  if (mf) await mf.dispose();
});

async function suscribir(prefs = {}, subscription) {
  const falsa = subscription || (await suscripcionFalsa());
  const cuerpo = { subscription: falsa.subscription, prefs };
  const res = await pedir(mf, '/subscribe', { metodo: 'POST', cuerpo, cabeceras: { Origin: ORIGEN_WEB } });
  return { ...res, ...falsa };
}

async function avisar(id, extras = {}) {
  return pedir(mf, '/notify', {
    metodo: 'POST',
    cuerpo: { id, ...AVISO, ...extras },
    cabeceras: { ...autorizacion(), Origin: ORIGEN_WEB }
  });
}

// ------------------------------------------------------------------ vapid y CORS

test('GET /vapid-public devuelve la clave publica', async () => {
  const res = await pedir(mf, '/vapid-public', { cabeceras: { Origin: ORIGEN_WEB } });
  assert.equal(res.estado, 200);
  assert.deepEqual(res.cuerpo, { key: VAPID_PUBLICA });
});

test('el preflight solo concede permiso a la web publicada y a localhost', async () => {
  const permitida = await pedir(mf, '/notify', { metodo: 'OPTIONS', cabeceras: { Origin: ORIGEN_WEB } });
  assert.equal(permitida.estado, 204);
  assert.equal(permitida.cabeceras['access-control-allow-origin'], ORIGEN_WEB);
  assert.match(permitida.cabeceras['access-control-allow-methods'], /POST/);
  assert.match(permitida.cabeceras['access-control-allow-headers'], /Authorization/);

  const local = await pedir(mf, '/subscribe', { metodo: 'OPTIONS', cabeceras: { Origin: 'http://127.0.0.1:8765' } });
  assert.equal(local.cabeceras['access-control-allow-origin'], 'http://127.0.0.1:8765');

  const ajena = await pedir(mf, '/subscribe', { metodo: 'OPTIONS', cabeceras: { Origin: 'https://meteosurf.example' } });
  assert.equal(ajena.estado, 204);
  assert.equal(ajena.cabeceras['access-control-allow-origin'], undefined, 'un origen desconocido no recibe permiso');
});

test('una ruta desconocida da 404 y un metodo incorrecto 405', async () => {
  assert.equal((await pedir(mf, '/inventada')).estado, 404);
  assert.equal((await pedir(mf, '/subscribe')).estado, 405);
  assert.equal((await pedir(mf, '/notify', { metodo: 'POST', cuerpo: {} })).estado, 401);
});

// -------------------------------------------------------------------- subscribe

test('suscribirse devuelve un id de 16 hex y sanea las preferencias', async () => {
  const res = await suscribir({
    spots: ['Planetario', 'malo!!'],
    alerts: { gente: false },
    minStars: 4,
    maxPerDay: 7
  });
  assert.equal(res.estado, 200);
  assert.match(res.cuerpo.id, /^[0-9a-f]{16}$/);
  assert.deepEqual(res.cuerpo.prefs.spots, ['planetario']);
  assert.equal(res.cuerpo.prefs.alerts.gente, false);
  assert.equal(res.cuerpo.prefs.maxPerDay, 3, 'techo absoluto');
  assert.ok(Array.isArray(res.cuerpo.avisos));
});

test('el cuerpo de mas de 4 KB se rechaza con 413', async () => {
  const falsa = await suscripcionFalsa();
  const relleno = 'a'.repeat(5000);
  const res = await pedir(mf, '/subscribe', {
    metodo: 'POST',
    cuerpo: { subscription: falsa.subscription, prefs: { spots: [relleno] } },
    cabeceras: { Origin: ORIGEN_WEB }
  });
  assert.equal(res.estado, 413);
  assert.match(res.cuerpo.error, /grande/);
});

test('una suscripcion invalida da 400 sin tocar el KV', async () => {
  const antes = await pedir(mf, '/subs', { cabeceras: autorizacion() });
  const numero = antes.cuerpo.length;

  const casos = [
    {},
    { subscription: { endpoint: 'http://push.ejemplo.com/x', keys: { p256dh: 'AA', auth: 'AA' } } },
    { subscription: { endpoint: 'no-es-una-url', keys: { p256dh: 'AA', auth: 'AA' } } },
    { subscription: { endpoint: 'https://push.ejemplo.com/x' } },
    { subscription: { endpoint: 'https://push.ejemplo.com/x', keys: { p256dh: 'corto', auth: 'AA' } } }
  ];
  for (const cuerpo of casos) {
    const res = await pedir(mf, '/subscribe', { metodo: 'POST', cuerpo, cabeceras: { Origin: ORIGEN_WEB } });
    assert.equal(res.estado, 400, JSON.stringify(cuerpo));
  }

  const despues = await pedir(mf, '/subs', { cabeceras: autorizacion() });
  assert.equal(despues.cuerpo.length, numero, 'no se guardo ninguna suscripcion rota');
});

test('un JSON roto da 400', async () => {
  const res = await pedir(mf, '/subscribe', { metodo: 'POST', cuerpo: '{roto', cabeceras: { Origin: ORIGEN_WEB } });
  assert.equal(res.estado, 400);
});

test('el mismo endpoint se suscribe una sola vez y no pierde el contador', async () => {
  const falsa = await suscripcionFalsa('https://push.ejemplo.com/uno');
  const primera = await suscribir({ spots: ['planetario'] }, falsa);
  await avisar(primera.cuerpo.id);
  const segunda = await suscribir({ spots: ['guru'] }, falsa);
  assert.equal(segunda.cuerpo.id, primera.cuerpo.id, 'mismo id para el mismo endpoint');

  const lista = await pedir(mf, '/subs', { cabeceras: autorizacion() });
  const encontrados = lista.cuerpo.filter((s) => s.id === primera.cuerpo.id);
  assert.equal(encontrados.length, 1);
  assert.equal(encontrados[0].sentToday, 1, 'el contador del dia sobrevive');
  assert.deepEqual(encontrados[0].prefs.spots, ['guru']);
});

// ----------------------------------------------------------- prefs y baja

test('POST /prefs guarda lo saneado y avisa de los ids desconocidos', async () => {
  const alta = await suscribir({}, await suscripcionFalsa('https://push.ejemplo.com/prefs'));
  const id = alta.cuerpo.id;

  const ok = await pedir(mf, '/prefs', {
    metodo: 'POST',
    cuerpo: { id, prefs: { spots: ['Gurugu', 'x'.repeat(60)], quiet: { from: 23, to: 7 }, maxPerDay: 1 } },
    cabeceras: { Origin: ORIGEN_WEB }
  });
  assert.equal(ok.estado, 200);
  assert.deepEqual(ok.cuerpo.prefs.spots, ['gurugu'], 'los ids de spot van en minusculas');
  assert.deepEqual(ok.cuerpo.prefs.quiet, { from: 23, to: 7 });
  assert.equal(ok.cuerpo.prefs.maxPerDay, 1);

  const malo = await pedir(mf, '/prefs', { metodo: 'POST', cuerpo: { id: 'no-es-un-id', prefs: {} } });
  assert.equal(malo.estado, 400);

  const fantasma = await pedir(mf, '/prefs', {
    metodo: 'POST',
    cuerpo: { id: '0123456789abcdef', prefs: {} }
  });
  assert.equal(fantasma.estado, 404);
});

test('POST /unsubscribe borra la suscripcion', async () => {
  const alta = await suscribir({}, await suscripcionFalsa('https://push.ejemplo.com/baja'));
  const id = alta.cuerpo.id;

  const baja = await pedir(mf, '/unsubscribe', { metodo: 'POST', cuerpo: { id }, cabeceras: { Origin: ORIGEN_WEB } });
  assert.deepEqual(baja.cuerpo, { ok: true });

  const lista = await pedir(mf, '/subs', { cabeceras: autorizacion() });
  assert.equal(lista.cuerpo.some((s) => s.id === id), false);
  assert.deepEqual((await avisar(id)).cuerpo, { sent: false, reason: 'gone' });
});

// ------------------------------------------------------------------ /subs

test('GET /subs pide token y no enseña endpoints ni claves', async () => {
  const sinToken = await pedir(mf, '/subs', { cabeceras: { Origin: ORIGEN_WEB } });
  assert.equal(sinToken.estado, 401);

  const tokenMalo = await pedir(mf, '/subs', {
    cabeceras: { Authorization: `Bearer ${ADMIN_TOKEN}x`, Origin: ORIGEN_WEB }
  });
  assert.equal(tokenMalo.estado, 401);

  const alta = await suscribir({ spots: ['planetario'] }, await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/secreto'));
  const lista = await pedir(mf, '/subs', { cabeceras: { ...autorizacion(), Origin: ORIGEN_WEB } });
  assert.equal(lista.estado, 200);
  assert.ok(Array.isArray(lista.cuerpo));
  const mio = lista.cuerpo.find((s) => s.id === alta.cuerpo.id);
  assert.ok(mio, 'la suscripcion nueva aparece en la lista');
  assert.deepEqual(Object.keys(mio).sort(), ['id', 'lastByTag', 'prefs', 'sentToday']);
  assert.equal(lista.texto.includes('fcm.googleapis.com'), false, 'no hay endpoints');
  assert.equal(lista.texto.includes('p256dh'), false, 'no hay claves');
});

// ------------------------------------------------------------------ /notify

test('un aviso valido se envia cifrado y cuenta en el dia', async () => {
  const pushLocal = pushServiceFalso(201);
  const worker = await crearWorker({ push: pushLocal });
  try {
    const falsa = await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/envio');
    const alta = await pedir(worker, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: falsa.subscription, prefs: { spots: ['planetario'] } }
    });
    const res = await pedir(worker, '/notify', {
      metodo: 'POST',
      cuerpo: { id: alta.cuerpo.id, ...AVISO },
      cabeceras: autorizacion()
    });
    assert.equal(res.estado, 200);
    assert.equal(res.cuerpo.sent, true);
    assert.equal(res.cuerpo.reason, 'ok');
    assert.equal(res.cuerpo.sentToday, 1);

    assert.equal(pushLocal.recibidos.length, 1);
    const enviado = pushLocal.recibidos[0];
    assert.equal(enviado.url, 'https://fcm.googleapis.com/fcm/send/envio');
    assert.match(enviado.headers.authorization, /^vapid t=/);
    assert.equal(enviado.headers['content-encoding'], 'aes128gcm');
    assert.ok(enviado.cuerpo.length > 80, 'el cuerpo va cifrado, no en claro');
    assert.equal(new TextDecoder().decode(enviado.cuerpo).includes('Olas ahora'), false, 'el titulo no viaja en claro');

    const lista = await pedir(worker, '/subs', { cabeceras: autorizacion() });
    const mio = lista.cuerpo.find((s) => s.id === alta.cuerpo.id);
    assert.equal(mio.sentToday, 1);
    assert.equal(typeof mio.lastByTag[AVISO.tag], 'number');
  } finally {
    await worker.dispose();
  }
});

test('el tope diario detiene el tercer aviso del dia', async () => {
  const worker = await crearWorker({ push: pushServiceFalso(201) });
  try {
    const falsa = await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/tope');
    const alta = await pedir(worker, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: falsa.subscription, prefs: { maxPerDay: 2 } }
    });
    const id = alta.cuerpo.id;
    for (const tag of ['uno', 'dos', 'tres']) {
      const res = await pedir(worker, '/notify', {
        metodo: 'POST',
        cuerpo: { id, title: 'Aviso', body: 'x', url: '/', tag },
        cabeceras: autorizacion()
      });
      const esperado = tag === 'tres' ? 'cap' : 'ok';
      assert.equal(res.cuerpo.reason, esperado, `tag ${tag}`);
    }
    assert.equal(await res_senviados(worker, id), 2);
  } finally {
    await worker.dispose();
  }
});

async function res_senviados(worker, id) {
  const lista = await pedir(worker, '/subs', { cabeceras: autorizacion() });
  return lista.cuerpo.find((s) => s.id === id).sentToday;
}

test('las horas de silencio bloquean a las 23:30 de Madrid', async () => {
  // 21:30 UTC = 23:30 en Madrid ( CEST).
  const worker = await crearWorker({ ahora: '2026-10-18T21:30:00Z', push: pushServiceFalso(201) });
  try {
    const falsa = await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/silencio');
    const alta = await pedir(worker, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: falsa.subscription, prefs: {} }
    });
    const res = await pedir(worker, '/notify', {
      metodo: 'POST',
      cuerpo: { id: alta.cuerpo.id, ...AVISO },
      cabeceras: autorizacion()
    });
    assert.deepEqual({ sent: res.cuerpo.sent, reason: res.cuerpo.reason }, { sent: false, reason: 'quiet' });
  } finally {
    await worker.dispose();
  }
});

test('el mismo tag no se repite en 6 h y a las 6 h vuelve a pasar', async () => {
  const dir = await carpetaTemporaria();
  try {
    const falsa = await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/dedupe');
    const alta = await crearWorker({ kvPersist: dir });
    let id;
    try {
      const res = await pedir(alta, '/subscribe', {
        metodo: 'POST',
        // Tope diario a 3 para que la dedupe se pueda ver sin que corte antes.
        cuerpo: { subscription: falsa.subscription, prefs: { maxPerDay: 3 } }
      });
      id = res.cuerpo.id;
    } finally {
      await alta.dispose();
    }

    const casos = [
      { ahora: '2026-10-18T12:00:00Z', esperado: 'ok', cuando: 'primer aviso (14:00 Madrid)' },
      { ahora: '2026-10-18T17:00:00Z', esperado: 'dup', cuando: '5 h despues (19:00 Madrid)' },
      { ahora: '2026-10-18T18:00:00Z', esperado: 'ok', cuando: '6 h justas del primero (20:00 Madrid)' },
      { ahora: '2026-10-18T19:00:00Z', esperado: 'dup', cuando: '1 h del tercero (21:00 Madrid)' },
      { ahora: '2026-10-19T08:05:00Z', esperado: 'ok', cuando: 'al dia siguiente (10:05 Madrid)' },
      { ahora: '2026-10-19T21:30:00Z', esperado: 'quiet', cuando: '23:30 Madrid, dentro del silencio' }
    ];
    for (const caso of casos) {
      const worker = await crearWorker({ ahora: caso.ahora, kvPersist: dir, push: pushServiceFalso(201) });
      try {
        const res = await pedir(worker, '/notify', {
          metodo: 'POST',
          cuerpo: { id, ...AVISO },
          cabeceras: autorizacion()
        });
        assert.equal(res.cuerpo.reason, caso.esperado, caso.cuando);
      } finally {
        await worker.dispose();
      }
    }
  } finally {
    await borrarCarpeta(dir);
  }
});

test('un 410 borra la suscripcion y un fallo de red no cuenta como enviado', async () => {
  const conGone = await crearWorker({ push: pushServiceFalso(410) });
  try {
    const alta = await pedir(conGone, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: (await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/gone')).subscription }
    });
    const res = await pedir(conGone, '/notify', {
      metodo: 'POST',
      cuerpo: { id: alta.cuerpo.id, ...AVISO },
      cabeceras: autorizacion()
    });
    assert.deepEqual({ sent: res.cuerpo.sent, reason: res.cuerpo.reason }, { sent: false, reason: 'gone' });
    const lista = await pedir(conGone, '/subs', { cabeceras: autorizacion() });
    assert.equal(lista.cuerpo.some((s) => s.id === alta.cuerpo.id), false, 'la suscripcion se limpia');
  } finally {
    await conGone.dispose();
  }

  const sinRed = await crearWorker({ push: pushServiceFalso('error-red') });
  try {
    const alta = await pedir(sinRed, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: (await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/red')).subscription }
    });
    const res = await pedir(sinRed, '/notify', {
      metodo: 'POST',
      cuerpo: { id: alta.cuerpo.id, ...AVISO },
      cabeceras: autorizacion()
    });
    assert.equal(res.cuerpo.sent, false);
    assert.equal(res.cuerpo.reason, 'error');
    assert.equal(await res_senviados(sinRed, alta.cuerpo.id), 0, 'un fallo de red no quema el dia');
  } finally {
    await sinRed.dispose();
  }
});

test('un 500 del push service tampoco cuenta como enviado', async () => {
  const worker = await crearWorker({ push: pushServiceFalso(500) });
  try {
    const alta = await pedir(worker, '/subscribe', {
      metodo: 'POST',
      cuerpo: { subscription: (await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/500')).subscription }
    });
    const res = await pedir(worker, '/notify', {
      metodo: 'POST',
      cuerpo: { id: alta.cuerpo.id, ...AVISO },
      cabeceras: autorizacion()
    });
    assert.equal(res.cuerpo.reason, 'error');
    assert.equal(await res_senviados(worker, alta.cuerpo.id), 0);
  } finally {
    await worker.dispose();
  }
});

test('notify valida sus entradas antes de tocar nada', async () => {
  const alta = await suscribir({}, await suscripcionFalsa('https://fcm.googleapis.com/fcm/send/validar'));
  const id = alta.cuerpo.id;
  const rechazados = [{ id: 'malo', title: 'x' }, { id, title: '' }, { id }, { id, title: 42 }];
  for (const cuerpo of rechazados) {
    const res = await pedir(mf, '/notify', { metodo: 'POST', cuerpo, cabeceras: autorizacion() });
    assert.equal(res.estado, 400, JSON.stringify(cuerpo));
    assert.equal(res.cuerpo.sent, false);
  }
  // Lo que no es texto (body, url) se ignora en vez de romper el aviso.
  const flojo = await avisar(id, { body: 42, url: {} });
  assert.equal(flojo.estado, 200);
  assert.equal(flojo.cuerpo.sent, true);
  const tituloLargo = await avisar(id, { title: 'a'.repeat(200), body: 'b'.repeat(400), url: 'c'.repeat(400), tag: 'd'.repeat(200) });
  assert.equal(tituloLargo.estado, 200, 'los campos largos se recortan, no se rechazan');
  assert.equal(tituloLargo.cuerpo.sent, true, 'sigue entrando: el tope por defecto son 2 al dia');
  assert.equal(tituloLargo.cuerpo.sentToday, 2);
});