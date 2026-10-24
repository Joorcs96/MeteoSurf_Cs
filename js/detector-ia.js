// detector-ia.js — Detecta PERSONA y TABLA con un modelo ya entrenado, en vez de
// adivinarlo con píxeles.
//
// Qué aporta esto y qué NO.
//
// APORTA: el modelo coco-ssd (SSD Lite MobileNet V2 entrenado con COCO) tiene
// clases que el detector de píxeles no puede tener. COCO incluye 'person' y
// también 'surfboard', así que "hay alguien" y "hay una tabla" dejan de ser
// conjeturas geométricas sobre manchas oscuras: son etiquetas entrenadas. En una
// escena de playa esto evita que una boya con espuma encima se lea como
// surfista.
//
// NO APORTA (y no se debe prometer): MEDIDAS. La precisión con surfistas REALES
// del club NO está medida, porque no hay ningún clip del club con un surfista
// confirmado y etiquetado. Este módulo NO publica ninguna cifra de acierto. Lo
// único que se puede decir con pruebas es que el código carga, infiere y
// devuelve cajas normalizadas. La calidad del modelo en un píxel lejano dentro
// del agua es una incógnita que hay que medir grabando clips etiquetados antes de
// fiarse de esto para decidir una ola. Mientre tanto, coco-ssd es un COMPLEMENTO
// de js/deteccion.js (que sí tiene umbrales medidos y rechazos probados), no un
// sustituto: la heurística de píxeles sigue siendo la que exige movimiento,
// recorrido y contacto.
//
// Dónde sale todo y por qué.
//
//   TensorFlow.js  4.22.0   Apache-2.0   https://github.com/tensorflow/tfjs
//   coco-ssd       2.2.3    Apache-2.0   https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
//   pesos SSD Lite MobileNet V2 (COCO)  https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json
//
// Las versiones van FIJADAS en las URLs de más abajo, sin rangos ni "latest": una
// app que descarga 18 MB de pesos tiene que saber qué está descargando. Se sirven
// por HTTPS desde jsDelivr (npm) y Google Cloud Storage (pesos); los dos son CDN
// públicos gratuitos, sin cuenta ni clave ni pago. NO se usa ningún servicio de
// pago y NO se envía ninguna imagen a ningún servidor: la inferencia ocurre en el
// navegador, sobre el lienzo local. Los pesos suman ~17,7 MB y el motor ~1,5 MB,
// así que la carga solo tiene sentido bajo demanda (nunca al abrir la página).
//
// Cómo se usa desde fuera (contrato exacto, pensado para js/cams.js):
//
//   import { crearDetectorIA } from './detector-ia.js';
//   const ia = crearDetectorIA();
//   await ia.cargar();                       // solo si quieres pagarlo antes
//   const r = await ia.detectar(video);      // o { video, banda: [y0, y1] }
//   // r.ok / r.estado / r.detecciones / r.error
//   ia.liberar();
//
// REGLA DE ORO DEL AUTOR (js/cams.js): las cajas de una inferencia son de UN
// fotograma. No se suman detecciones de dos llamadas ni se guardan cajas de un
// fotograma para aplicarlas al siguiente: por eso cada resultado lleva su
// `marcoId`, su `tMs` (el del fotograma, no el de la respuesta) y su `roi`, y
// existe `esFresco(detector, resultado)` para descartar lo que llegó tarde. Un
// fotograma vale lo que vale; el fotograma SIGUIENTE es otro.

// ------------------------------------------------------------------ fijaciones

// Versiones exactas. Cambiar cualquiera de estas tres líneas es cambiar el
// modelo que se descarga, así que van en un solo sitio y con el número escrito.
export const VERSIONES = Object.freeze({
  tfjs: '4.22.0',
  cocoSsd: '2.2.3',
  pesos: 'ssdlite_mobilenet_v2', // subcarpeta real: base 'lite_mobilenet_v2' -> prefijo 'ssd' + base
});

// Build UMD de cada paquete. NO son módulos ESM: se cargan con <script> y se
// publican en window.tf y window.cocoSsd. Comprobado en los ficheros servidos:
// el de tfjs acaba en `}))` y el de coco-ssd es `!function(e,a){...}(this,...)`,
// o sea UMD puro, y por eso `import()` dinámico devolvería un módulo VACÍO.
// (Los ficheros `dist/index.js` de estos paquetes sí son ESM, pero usan
// especificadores desnudos como '@tensorflow/tfjs-core', que un navegador sin
// empaquetador no puede resolver. De ahí el <script>.) El orden importa: coco-ssd
// lee window.tf al cargarse, así que tfjs va primero.
export const URL_TFJS = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${VERSIONES.tfjs}/dist/tf.min.js`;
export const URL_COCO_SSD = `https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@${VERSIONES.cocoSsd}/dist/coco-ssd.min.js`;
export const URL_MODELO = `https://storage.googleapis.com/tfjs-models/savedmodel/${VERSIONES.pesos}/model.json`;

// Licencias, con el enlace donde se puede leer el texto entero. Las tres son
// Apache-2.0, la misma del motor TensorFlow; los pesos entrenados con COCO se
// distribuyen bajo esa licencia y el dataset de entrenamiento (COCO) es CC BY
// 4.0, que no obliga a nada aquí porque este proyecto no redistribuye el dataset.
export const LICENCIAS = Object.freeze({
  tfjs: 'Apache-2.0 · https://github.com/tensorflow/tfjs/blob/master/LICENSE',
  cocoSsd: 'Apache-2.0 · https://github.com/tensorflow/tfjs-models/blob/master/LICENSE',
  pesos: 'Apache-2.0 · https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd',
});

// --------------------------------------------------------------------- ajustes

export const AJUSTES_IA = Object.freeze({
  // Clases que interesan. Las demás se descartan: un loro o un ganso de COCO
  // no aporta nada a "hay alguien con una tabla".
  clases: Object.freeze(['person', 'surfboard']),

  // El filtro de confianza se aplica AQUÍ, no en el modelo. Se pide al modelo un
  // listón bajo (minScoreBruto) y se descarta por encima de este valor, para
  // poder distinguir "no ha visto nada" de "lo ha visto y no me lo creo".
  minScoreBruto: 0.20,
  confianzaMin: 0.35,
  maxCajas: 20,

  // Lienzo de inferencia. El modelo internamente trabaja a 300x300, así que más
  // de esto no aporta detalle: solo coste. 320x180 mantiene la proporción de una
  // cámara de playa y deja detalle real en un surfista a media distancia.
  anchoInferencia: 320,
  altoInferencia: 180,

  // Tope de cada fase. Una inferencia colgada no puede dejar la vigía esperando
  // para siempre, y una carga de 18 MB en una red mala tampoco. Pasado el plazo
  // se devuelve un error explícito y se suelta el cerrojo de "en curso": peor un
  // fotograma perdido que un bloqueo.
  timeoutCargaMs: 90000,
  timeoutInferenciaMs: 5000,

  // Emparejar cada persona con la tabla más cercana (radio en fracción del alto
  // del ROI). Puramente informativo: NO decide si alguien coge una ola, eso lo
  // decide js/deteccion.js con señales de movimiento.
  emparejarTabla: true,
  contactoMaxFrac: 1.2,

  // Ventana de frescura EXTRA, para el autor que quiera un descarte por reloj.
  // 0 = desactivado, y es el valor por defecto a propósito: una inferencia real
  // con este modelo tarda del orden de 1,2 s en un portátil corriente, así que
  // un plazo más corto que eso tiraría TODOS los resultados y la detección no
  // serviría de nada. El descarte que sí se aplica siempre, sin depender de
  // ningún plazo, es el de abajo: si el fotograma ya no es el último pedido, sus
  // cajas se vacían.
  caducidadMs: 0,
});

// Códigos de error. Explícitos y cerrados: el autor decide qué hacer con cada uno
// sin tener que leer el texto del mensaje.
export const CODIGO = Object.freeze({
  SIN_NAVEGADOR: 'sin_navegador',
  IMPORT_FALLIDO: 'import_fallido',
  CARGA_FALLIDA: 'carga_fallida',
  TIMEOUT_CARGA: 'timeout_carga',
  TIMEOUT_INFERENCIA: 'timeout_inferencia',
  INFERENCIA_FALLIDA: 'inferencia_fallida',
  MARCO_INVALIDO: 'marco_invalido',
  LIBERADO: 'liberado',
});

const frase = (codigo, mensaje) => ({ codigo, mensaje });

// ------------------------------------------------------------------- utilidades

// Un error normalizado de este módulo: siempre con `codigo` y `mensaje` en
// español, para que el informe al usuario no tenga que traducir nada.
export function errorIA(codigo, mensaje, causa = null) {
  const e = new Error(mensaje);
  e.codigo = codigo;
  e.causa = causa;
  return e;
}

// Ceder el hilo al navegador antes de trabajo pesado. Sin esto, una inferencia
// larga congela un cuadro de la interfaz y el usuario piensa que la página se ha
// colgado. En un Web Worker no hay `requestAnimationFrame`, así que se cae a
// `setTimeout`.
function ceder() {
  return new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
    else setTimeout(r, 0);
  });
}

// Promesa con plazo. Al vencer, se rechaza con un error del módulo; el reloj se
// limpia siempre y la promesa original se deja con un `catch` vacío para que su
// rechazo posterior no salga como "unhandled rejection" en consola.
function conPlazo(promesa, ms, codigo, mensaje) {
  let reloj = null;
  const watchdog = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(errorIA(codigo, mensaje)), ms);
  });
  promesa.catch(() => {}); // el rechazo tardío no debe ensuciar la consola
  return Promise.race([promesa, watchdog]).finally(() => clearTimeout(reloj));
}

// Convierte una caja en píxeles del ROI a coordenadas normalizadas 0..1. Se
// recortan al ROI: una caja que se sale del fotograma es un recorte, no un error,
// y una caja invertida es basura que se descarta.
//
// Acepta las DOS formas que aparecen: la de coco-ssd, que es un ARRAY
// [x, y, ancho, alto] en píxeles, y un objeto {x, y, width, height}. Se acepta
// también el nombre en castellano por si algún adaptador entrega esa forma.
export function normalizarCaja(bbox, ancho, alto) {
  if (!bbox || !(ancho > 0) || !(alto > 0)) return null;
  const esArray = Array.isArray(bbox);
  const x = esArray ? bbox[0] : (bbox.x ?? bbox.left ?? 0);
  const y = esArray ? bbox[1] : (bbox.y ?? bbox.top ?? 0);
  const w = esArray ? bbox[2] : (bbox.width ?? bbox.ancho ?? 0);
  const h = esArray ? bbox[3] : (bbox.height ?? bbox.alto ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) return null;
  const x0 = Math.min(1, Math.max(0, x / ancho));
  const y0 = Math.min(1, Math.max(0, y / alto));
  const x1 = Math.min(1, Math.max(0, (x + w) / ancho));
  const y1 = Math.min(1, Math.max(0, (y + h) / alto));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

// Traduce la salida cruda de coco-ssd a la forma que consume el autor. Es una
// función suelta y sin dependencias a propósito: se puede probar con resultados
// inventados, que es como se comprueba que no se cuela una caja sin clase o sin
// confianza, y que los valores salen normalizados y recortados.
export function normalizarDetecciones(bruto, a = AJUSTES_IA) {
  const permitidas = new Set(a.clases);
  const salida = [];
  for (const d of bruto || []) {
    const clase = d?.class;
    if (!permitidas.has(clase)) continue;
    const confianza = Number(d?.score);
    if (!Number.isFinite(confianza) || confianza < a.confianzaMin) continue;
    const caja = normalizarCaja(d.bbox, d.anchoRoi, d.altoRoi);
    if (!caja) continue;
    salida.push({
      clase,
      confianza: +Math.min(1, confianza).toFixed(3),
      bbox: caja,
      centro: { x: +(caja.x + caja.ancho / 2).toFixed(4), y: +(caja.y + caja.alto / 2).toFixed(4) },
      area: +(caja.ancho * caja.alto).toFixed(5),
    });
  }
  // Orden estable: primero las personas, y dentro de cada clase de mayor a menor
  // confianza. El emparejamiento es determinista así.
  salida.sort((p, q) =>
    p.clase === q.clase ? q.confianza - p.confianza : (p.clase === 'person' ? -1 : 1));
  return salida;
}

// A cada persona le pega la tabla más cercana que esté dentro del radio. NO es
// una decisión: es un dato para que quien_integracion lo contraste con el
// movimiento que da js/deteccion.js, que es el que sí sabe si alguien coge ola.
export function emparejar(detecciones, a = AJUSTES_IA) {
  const personas = detecciones.filter((d) => d.clase === 'person');
  const tablas = detecciones.filter((d) => d.clase === 'surfboard');
  const escala = Math.max(...personas.map((p) => p.bbox.alto), 0.001);
  const radio = a.contactoMaxFrac * escala;
  return personas.map((p) => {
    let mejor = null, mejorDist = radio;
    for (const t of tablas) {
      const dx = t.centro.x - p.centro.x;
      const dy = t.centro.y - p.centro.y;
      const d = Math.hypot(dx, dy);
      if (d < mejorDist) { mejorDist = d; mejor = t; }
    }
    return {
      persona: p,
      tabla: mejor,
      contacto: mejor ? +(1 - mejorDist / radio).toFixed(3) : null,
      distancia: mejor ? +mejorDist.toFixed(4) : null,
    };
  });
}

// ¿Este resultado sigue describiendo el fotograma que el detector está mirando?
// Si el autor ha avanzado a otro fotograma, las cajas de éste ya no se pueden
// aplicar al nuevo: se descartan. Es la barrera que impide que detecciones de un
// fotograma viejo se mezclen con las del actual.
export function esFresco(detector, resultado) {
  if (!resultado || !resultado.marcoId) return false;
  return resultado.marcoId === detector.ultimoMarcoId();
}

// ------------------------------------------------------------------ adaptador

// Inyecta un <script> de CDN y espera a que se haya ejecutado. Con `async` no
// bloquea el HTML ni el resto de scripts de la página: la interfaz sigue
// respondiendo mientras se descargan 1,5 MB. Se comprueba el global porque un
// script puede "cargar" bien y no publicar nada (CSP bloqueada, red a medias) y
// eso hay que verlo como fallo de carga, no como un `tf` indefinido más tarde.
export function cargarScript(url, nombreGlobal, ms = 60000) {
  if (globalThis[nombreGlobal]) return Promise.resolve(globalThis[nombreGlobal]);
  return new Promise((cumplir, fallar) => {
    const el = document.createElement('script');
    let reloj = null;
    const limpiar = () => { clearTimeout(reloj); el.remove?.(); };
    el.src = url;
    el.async = true;
    el.crossOrigin = 'anonymous'; // los CDNs de npm mandan CORS abierto
    el.onload = () => {
      limpiar();
      if (globalThis[nombreGlobal]) cumplir(globalThis[nombreGlobal]);
      else fallar(errorIA(CODIGO.IMPORT_FALLIDO,
        `El script ${nombreGlobal} se descargó pero no llegó a publicarse: puede haber una CSP que lo bloquee o una extensión que lo intercepta.`));
    };
    el.onerror = () => {
      limpiar();
      fallar(errorIA(CODIGO.IMPORT_FALLIDO,
        `No se pudo descargar ${nombreGlobal} desde ${new URL(url).host}: sin red, con el CDN caído o con el HTTPS bloqueado.`));
    };
    reloj = setTimeout(() => {
      limpiar();
      fallar(errorIA(CODIGO.TIMEOUT_CARGA, `El script ${nombreGlobal} no terminó en ${ms} ms.`));
    }, ms);
    document.head.appendChild(el);
  });
}

// Adaptador por defecto: TensorFlow.js + coco-ssd desde CDN. Se inyecta entero
// para poder probar el resto del módulo sin red y sin descargar 18 MB.
async function adaptadorPorDefecto({ tf, cocoSsd }, opciones) {
  const wanted = opciones.backend || 'webgl';
  try {
    if (tf.getBackend() !== wanted) await tf.setBackend(wanted);
  } catch {
    // Sin WebGL (navegador viejo, bloqueado, o sin GPU) se sigue con el backend
    // que ya tenga tf: peor lento que sin detectar, y se publica cuál se usó.
  }
  await tf.ready();
  // modelUrl explícito: así el modelo no depende de cómo la librería componga
  // el nombre a partir de `base`, y la URL que se descarga está escrita aquí.
  const modelo = await cocoSsd.load({ modelUrl: opciones.modelUrl || URL_MODELO });
  return {
    modelo,
    meta: {
      backend: tf.getBackend(),
      versionTf: tf.version?.tfjs ?? null,
      versionCoco: cocoSsd.version ?? null,
      pesos: opciones.modelUrl || URL_MODELO,
    },
  };
}

// --------------------------------------------------------------------- módulo

/**
 * Crea un detector de persona/tabla con modelo entrenado.
 *
 * Devuelve { ajustes, cargar, detectar, liberar, estado, ultimoMarcoId }.
 *
 * - `cargar()`  -> Promise<{ok}>. Idempotente: dos llamadas comparten la misma
 *   descarga. No hace falta llamarla: `detectar()` carga si falta, salvo que se
 *   pase `autoCargar: false`.
 * - `detectar(entrada, opciones)` -> Promise<resultado>. SIEMPRE resuelve, nunca
 *   rechaza: el error va dentro de `resultado.error` con su código. `entrada`
 *   puede ser un <video>, un <canvas>, un ImageData o un objeto
 *   `{ video, banda: [y0, y1], tMs }` para recortar una franja del encuadre.
 * - `liberar()` -> suelta el modelo y la memoria. Después, `detectar()` devuelve
 *   error `liberado` en vez de re-descargar 18 MB sin que nadie lo pidiera.
 *
 * Opciones para pruebas: `cargarModelo` (sustituye TODO el camino del modelo) e
 * `cargarLibrerias` (sustituye solo la descarga por CDN, dejando vivo el resto).
 */
export function crearDetectorIA(opciones = {}) {
  const a = { ...AJUSTES_IA, ...(opciones.ajustes || {}) };
  a.clases = [...(opciones.ajustes?.clases ?? AJUSTES_IA.clases)];

  const inyeccion = typeof opciones.cargarModelo === 'function';
  const autoCargar = opciones.autoCargar !== false;
  const timeoutCarga = a.timeoutCargaMs;
  const timeoutInferencia = a.timeoutInferenciaMs;

  let modelo = null;
  let meta = null;
  let tensorflow = null;
  let carga = null;      // promesa de carga en curso o ya resuelta
  let enCurso = null;    // promesa de inferencia en curso (cerrojo)
  let liberado = false;

  let contador = 0;      // id de cada fotograma que se ha pedido
  let ultimoId = 0;      // id del último fotograma que se ha DIBUJADO
  let ultimoEntregado = null;

  const cuentas = { inferencias: 0, omitidas: 0, obsoletas: 0, errores: 0, ultimaMs: null };

  // --- lienzo propio. El del autor es pequeño (160x90 para la heurística) y
  // --- redimensionarlo rompería su bucle, así que este módulo usa el suyo.
  let lienzo = null;
  let ctx = null;
  function obtenerLienzo() {
    if (!lienzo) {
      lienzo = document.createElement('canvas');
      lienzo.width = a.anchoInferencia;
      lienzo.height = a.altoInferencia;
      ctx = lienzo.getContext('2d', { willReadFrequently: true });
    }
    return lienzo;
  }

  function resultadoBase(marcoId, tMs, estado, extra = {}) {
    return {
      ok: estado === 'listo',
      estado,
      error: null,
      detecciones: [],
      pares: [],
      recuento: { person: 0, surfboard: 0 },
      tienePersona: false,
      tieneTabla: false,
      marcoId,
      tMs,                 // el del FOTOGRAMA, tomado al dibujar, no al responder
      fuente: null,
      roi: null,
      modelo: null,        // quién produjo esto: ids de versión, no un objeto
      ms: null,
      ...extra,
    };
  }

  // ---- carga bajo demanda, una sola vez, con plazo ----
  function cargar() {
    if (liberado) return Promise.resolve({ ok: false, error: frase(CODIGO.LIBERADO, 'El detector se liberó: hay que crear otro para volver a cargar el modelo.') });
    if (carga) return carga; // ya en curso o ya resuelta: no se descarga dos veces

    carga = (async () => {
      try {
        if (inyeccion) {
          const r = await conPlazo(Promise.resolve(opciones.cargarModelo()), timeoutCarga,
            CODIGO.TIMEOUT_CARGA, `La carga del modelo inyectado pasó de ${timeoutCarga} ms.`);
          modelo = r?.modelo ?? r;
          meta = { backend: 'inyectado', pesos: 'inyectado', ...(r?.meta || {}) };
          return { ok: true, meta };
        }
        // Los <script> se inyectan aquí, no al abrir la página: hasta que se
        // llama a cargar() no se toca la red. El orden es obligatorio.
        const ms = timeoutCarga;
        const libs = opciones.cargarLibrerias
          ? await opciones.cargarLibrerias()
          : {
            tf: await cargarScript(URL_TFJS, 'tf', ms),
            cocoSsd: await cargarScript(URL_COCO_SSD, 'cocoSsd', ms),
          };
        tensorflow = libs.tf ?? null;
        const r = await conPlazo(adaptadorPorDefecto(libs, opciones), timeoutCarga,
          CODIGO.CARGA_FALLIDA,
          `No se pudieron descargar los pesos del modelo en ${timeoutCarga} ms (~17,7 MB).`);
        modelo = r.modelo;
        meta = r.meta;
        return { ok: true, meta };
      } catch (e) {
        // La promesa de carga se olvida a propósito: si se cacheara el
        // rechazo, este detector no podría reintentarlo nunca.
        carga = null;
        const codigo = e?.codigo === CODIGO.TIMEOUT_CARGA
          ? CODIGO.TIMEOUT_CARGA
          : (e?.codigo === CODIGO.IMPORT_FALLIDO ? CODIGO.IMPORT_FALLIDO : CODIGO.CARGA_FALLIDA);
        cuentas.errores++;
        return { ok: false, error: frase(codigo, e?.message || 'No se pudo cargar el modelo de detección.') };
      }
    })();

    return carga;
  }

  // ---- preparar el fotograma: dibujar y quedarse con su tamaño real ----
  function prepararMarco(entrada) {
    const esImageData = typeof ImageData !== 'undefined' && entrada instanceof ImageData;
    if (entrada && typeof entrada === 'object' && !esImageData &&
        (entrada.video || entrada.canvas || entrada.imageData || entrada.banda)) {
      const { video, canvas, imageData, banda, tMs } = entrada;
      const fuente = video ? 'video' : canvas ? 'canvas' : imageData ? 'imageData' : null;
      if (!fuente) return { error: frase(CODIGO.MARCO_INVALIDO, 'No hay ni vídeo, ni lienzo, ni ImageData que mirar.') };

      const anchoRoi = a.anchoInferencia;
      const altoRoi = a.altoInferencia;

      if (fuente === 'video') {
        // Sin fotograma decodificado no hay nada que mirar: readyState < 2 o
        // anchura 0 significan "todavía no", no "falló".
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
          return { error: frase(CODIGO.MARCO_INVALIDO, 'El vídeo todavía no tiene un fotograma listo.') };
        }
        const l = obtenerLienzo();
        const sy = Math.floor((banda?.[0] ?? 0) * video.videoHeight);
        const sh = Math.max(1, Math.floor(((banda?.[1] ?? 1) - (banda?.[0] ?? 0)) * video.videoHeight));
        ctx.drawImage(video, 0, sy, video.videoWidth, sh, 0, 0, anchoRoi, altoRoi);
        return {
          lienzo: l, fuente, tMs: tMs ?? Date.now(),
          roi: { ancho: anchoRoi, alto: altoRoi, banda: banda ?? [0, 1], origen: 'video', anchoFuente: video.videoWidth, altoFuente: video.videoHeight },
        };
      }
      if (fuente === 'canvas') {
        const w = canvas.width, h = canvas.height;
        if (!w || !h) return { error: frase(CODIGO.MARCO_INVALIDO, 'El lienzo tiene tamaño cero.') };
        const l = obtenerLienzo();
        ctx.drawImage(canvas, 0, 0, w, h, 0, 0, anchoRoi, altoRoi);
        return {
          lienzo: l, fuente, tMs: tMs ?? Date.now(),
          roi: { ancho: anchoRoi, alto: altoRoi, banda: [0, 1], origen: 'canvas', anchoFuente: w, altoFuente: h },
        };
      }
      // ImageData se entrega tal cual: el autor ya sabe cómo lo ha recortado.
      const iw = imageData.width, ih = imageData.height;
      if (!iw || !ih) return { error: frase(CODIGO.MARCO_INVALIDO, 'El ImageData viene vacío.') };
      const l = obtenerLienzo();
      ctx.putImageData(imageData, 0, 0);
      return {
        lienzo: l, fuente, tMs: tMs ?? Date.now(),
        roi: { ancho: iw, alto: ih, banda: [0, 1], origen: 'imageData', anchoFuente: iw, altoFuente: ih },
      };
    }

    // Entrada suelta: un <video>, un <canvas> o un ImageData pelados.
    if (entrada && typeof entrada.videoWidth === 'number') return prepararMarco({ video: entrada });
    if (entrada && typeof entrada.getContext === 'function') return prepararMarco({ canvas: entrada });
    if (entrada && typeof entrada.data === 'object') return prepararMarco({ imageData: entrada });
    return { error: frase(CODIGO.MARCO_INVALIDO, 'No se reconoce la entrada: se esperaba un vídeo, un lienzo, un ImageData o { video, banda }.') };
  }

  // ---- inferencia ----
  async function detectar(entrada, opcionesDetectar = {}) {
    const id = ++contador;
    // El plazo se puede acortar en una llamada concreta (fotograma de prueba) sin
    // tocar los ajustes del detector.
    const plazoInferencia = Number(opcionesDetectar.timeoutInferenciaMs) > 0
      ? Number(opcionesDetectar.timeoutInferenciaMs)
      : timeoutInferencia;

    if (liberado) {
      cuentas.errores++;
      return resultadoBase(id, Date.now(), 'error', { error: frase(CODIGO.LIBERADO, 'El detector se liberó antes de inferir.') });
    }
    // Cerrojo: NUNCA dos inferencias a la vez. No se encola ni se espera (eso
    // acumularía fotogramas viejos y bloquearía al autor): se dice que no y ya.
    // En una cámara a 10 fps con inferencia de 300 ms esto salta a menudo, y es
    // lo correcto: preferimos perder un fotograma a mirarle el equivocado.
    if (enCurso) {
      cuentas.omitidas++;
      return resultadoBase(id, Date.now(), 'omitido', {
        error: null,
        motivo: 'inferencia_en_curso',
        omisiones: cuentas.omitidas,
      });
    }
    const marco = prepararMarco(entrada);
    if (marco.error) {
      cuentas.errores++;
      return resultadoBase(id, Date.now(), 'error', { error: marco.error });
    }
    ultimoId = id;

    if (!modelo) {
      if (!autoCargar) {
        return resultadoBase(id, marco.tMs, 'error', {
          error: frase(CODIGO.CARGA_FALLIDA, 'El modelo no está cargado y autoCargar está desactivado: hay que llamar a cargar().'),
        });
      }
      const r = await cargar();
      if (!r.ok) {
        cuentas.errores++;
        return resultadoBase(id, marco.tMs, 'error', { error: r.error, modelo: null });
      }
      // Puede haberse liberado mientras descargaba: se suelta lo recién cargado.
      if (liberado) {
        try { modelo?.dispose?.(); } catch { /* nada que salvar */ }
        modelo = null;
        return resultadoBase(id, marco.tMs, 'error', { error: frase(CODIGO.LIBERADO, 'Se liberó el detector mientras cargaba el modelo.') });
      }
    }

    const roi = marco.roi;
    const crudo = (async () => modelo.detect(marco.lienzo, a.maxCajas, a.minScoreBruto))();
    const t0 = performanceNow();
    const trabajo = conPlazo(crudo, plazoInferencia, CODIGO.TIMEOUT_INFERENCIA,
      `La inferencia pasó de ${plazoInferencia} ms: fotograma descartado.`)
      .then((lista) => {
        // El tamaño del ROI va pegado a cada caja cruda: normalizar es una
        // función pura y así se puede probar sin lienzo ni navegador.
        return (lista || []).map((d) => ({ ...d, anchoRoi: roi.ancho, altoRoi: roi.alto }));
      });

    enCurso = trabajo;
    let salida;
    try {
      const lista = await trabajo;
      const detecciones = normalizarDetecciones(lista, a);
      const pares = a.emparejarTabla ? emparejar(detecciones, a) : [];
      salida = resultadoBase(id, marco.tMs, detecciones.length ? 'listo' : 'sin_deteccion', {
        detecciones, pares,
        // Atajos para el autor: son lo único que necesita para pintar y para
        // decidir si esto se solapa con lo que dice la heurística de píxeles.
        recuento: {
          person: detecciones.filter((x) => x.clase === 'person').length,
          surfboard: detecciones.filter((x) => x.clase === 'surfboard').length,
        },
        tienePersona: detecciones.some((x) => x.clase === 'person'),
        tieneTabla: detecciones.some((x) => x.clase === 'surfboard'),
        fuente: marco.fuente, roi,
        modelo: meta ? { ...meta, id: `coco-ssd@${VERSIONES.cocoSsd}/${VERSIONES.pesos}` } : null,
      });
    } catch (e) {
      cuentas.errores++;
      const codigo = e?.codigo === CODIGO.TIMEOUT_INFERENCIA ? CODIGO.TIMEOUT_INFERENCIA : CODIGO.INFERENCIA_FALLIDA;
      salida = resultadoBase(id, marco.tMs, 'error', { error: frase(codigo, e?.message || 'La inferencia falló.') });
    } finally {
      // El cerrojo se suelta SIEMPRE, también en el error: si no, un solo fallo
      // dejaría el detector muerto para el resto de la sesión.
      if (enCurso === trabajo) enCurso = null;
    }

    salida.ms = Math.round(performanceNow() - t0);
    cuentas.ultimaMs = salida.ms;
    if (salida.ok) cuentas.inferencias++;
    // Frescura. Lo que NO depende de ningún plazo: si este fotograma ya no es
    // el último que se ha pedido, sus cajas no describen lo que se está
    // mirando y se vacían. Eso es la barrera que impide mezclar detecciones de
    // fotogramas viejos, y está siempre activa.
    const caducado = (a.caducidadMs > 0 && Date.now() - marco.tMs > a.caducidadMs)
      || salida.marcoId !== ultimoId;
    if (caducado) {
      cuentas.obsoletas++;
      salida.estado = 'obsoleto';
      salida.ok = false;
      salida.detecciones = [];
      salida.pares = [];
      salida.recuento = { person: 0, surfboard: 0 };
      salida.tienePersona = salida.tieneTabla = false;
      salida.error = frase('marco_obsoleto', 'El fotograma llegó tarde: ya no describe lo que se está mirando.');
    }
    ultimoEntregado = salida;
    return salida;
  }

  function liberar() {
    if (liberado) return { ok: true, yaLiberado: true };
    liberado = true;
    try { modelo?.dispose?.(); } catch { /* se suelta igual */ }
    modelo = null;
    tensorflow = null; // que el recolector se lleve tensores y pesos
    carga = null;
    enCurso = null;
    if (lienzo) { lienzo.width = lienzo.height = 1; lienzo = null; ctx = null; }
    return { ok: true };
  }

  function estado() {
    return {
      cargado: !!modelo,
      liberado,
      ocupado: !!enCurso,
      modelo: meta ? { ...meta, id: `coco-ssd@${VERSIONES.cocoSsd}/${VERSIONES.pesos}` } : null,
      rois: { ancho: a.anchoInferencia, alto: a.altoInferencia },
      clases: [...a.clases],
      tensores: tensorflow?.memory?.()?.numTensors ?? null,
      ...cuentas,
      ultimo: ultimoEntregado
        ? {
            estado: ultimoEntregado.estado,
            marcoId: ultimoEntregado.marcoId,
            tMs: ultimoEntregado.tMs,
            ms: ultimoEntregado.ms,
            recuento: ultimoEntregado.recuento,
          }
        : null,
    };
  }

  return {
    ajustes: a,
    cargar,
    detectar,
    liberar,
    estado,
    ultimoMarcoId: () => ultimoId,
    esFresco: (r) => esFresco({ ultimoMarcoId: () => ultimoId }, r),
  };
}

// `performance.now` con reserva: no existe en Node plano y aquí solo se usa para
// medir, así que un reloj deBENCH vale igual.
function performanceNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
