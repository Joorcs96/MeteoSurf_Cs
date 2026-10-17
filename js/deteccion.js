// deteccion.js — Detecta a un surfista COGIENDO ola en la imagen de una webcam.
//
// Por qué no basta con bajar un umbral de movimiento: una boya oscila, una
// espuma cruza, un bañista camina por la orilla y un surfista quieto esperando la
// serie en el pico mueven la imagen tanto como alguien que está cogiendo una ola.
// Por eso aquí no se decide con una sola magnitud, sino exigiendo a la vez
// CUATRO señales independientes y dejando escrito cuál falta:
//
//   1. PERSONA     — una forma vertical pegada a la tabla.
//   2. TABLA       — una forma alargada, tendida, con el eje mayor horizontal.
//   3. MOVIMIENTO  — desplazamiento neto y dirección sostenida en el tiempo.
//   4. RECORRIDO   — ha cruzado una porción real de la rompiente en la ventana,
//                    que es lo que hace alguien que coge una ola frente a uno
//                    que solo está remando o esperando.
//
// La espuma se separa por POLARIDAD, no bajando el listón: la espuma aparece más
// CLARA que el fondo y un surfista aparece más OSCURO, así que se cuentan por
// separado. La boya y el surfista quieto se separan por el desplazamiento neto
// acumulado en la ventana, no por su velocidad instantánea.
//
// Lo que NO se usa como condición: el ángulo entre la tabla y la dirección de
// avance. En una cámara de playa, un surfista que coge la ola avanza a lo largo
// de la rompiente con la tabla casi paralela al movimiento, así que exigir
// perpendicularidad habría descartado justo lo que se busca. Ese ángulo se mide
// y se publica en el informe, pero no decide: depende de dónde esté la cámara,
// que no se ha medido en ninguno de los spots.
//
// No usa ninguna librería: solo píxeles en escala de grises. Los fotogramas se
// analizan en una rejilla pequeña (`anchoAnalisis` x `altoAnalisis`) porque los
// umbrales están en unidades de esa rejilla y así el coste es constante.
//
// Los umbrales son deliberadamente ALTOS (conservadores): es preferible no grabar
// una ola a marcar un bañista. Todo se ajusta en AJUSTES_DETECCION, donde cada
// valor explica qué se rompe si se baja.

// ---------------------------------------------------------------------- ajustes

export const AJUSTES_DETECCION = {
  // Rejilla de análisis. Los tamaños y umbrales de píxel valen en esta rejilla.
  anchoAnalisis: 160,
  altoAnalisis: 90,

  // Fondo temporal: media móvil exponencial por píxel. Se sube para seguir la
  // escena despacio (nubes, cambio de luz) y se baja para adaptarse de prisa.
  cuadrosFondo: 90,
  // Si el fondo está sin inicializar, se rellena con el primer fotograma.
  rellenarFondo: true,

  // Polaridad: diferencia de gris respecto al fondo necesaria para contar un
  // píxel. `contrasteOscuro` es la persona y la tabla (más oscuras que el agua);
  // `contrasteClaro` es la espuma. Bajar `contrasteOscuro` mete ruido de textura.
  contrasteOscuro: 18,
  contrasteClaro: 26, // más alto: la espuma tiene que destacar de verdad

  // Banda vertical donde está el agua, de horizonte a orilla, en fracción del
  // alto de análisis. Fuera de aquí no se buscan surfistas (el cielo no genera
  // candidatos y los reflejos de la arena tampoco).
  roiAgua: [0.30, 0.96],

  // Tamaño mínimo para que un blob pueda ser una persona. Por debajo son
  // gaviotas, boyas lejanas o la pleasurecraft de un técnico.
  altoMinPersonaFrac: 0.075,
  areaMinPx: 10,

  // Persona: forma vertical. `altoSobreAncho` es la relación mínima para no
  // aceptar un rectángulo amorphous; `alturaMinPersonaFrac` la altura mínima.
  altoSobreAnchoPersona: 1.05,
  alturaMinPersonaFrac: 0.055,
  // Distancia máxima entre centroides de persona y tabla, en múltiplos de la
  // altura de la persona. Subirla admite poses tumbadas; bajarla exige contacto.
  contactoMaxFrac: 1.35,

  // Tabla: tendida, alargada y fina. `elongacionMin` = ejeMayor/ejeMenor y
  // `desvioHorizontalMaxGrados` es la desviación respecto a la horizontal.
  elongacionTablaMin: 2.1, // eje mayor / eje menor mínimo
  grosorTablaMaxFrac: 0.42, // una tabla no puede ser alta como el encuadre
  desvioHorizontalMaxGrados: 34, // de la horizontal; más alto entra la espuma
  anchoTablaMinFrac: 0.030,

  // Seguimiento temporal.
  radioAsociacionFrac: 0.14, // del ancho de análisis, para no saltar de objeto
  cuadrosMinimos: 4,
  ventanaS: 5.0, // longitud de la ventana sobre la que se mide el movimiento

  // Movimiento. Los umbrales van en PÍXELES por segundo de la rejilla, no en
  // metros: la escala real de cada cámara es distinta y no se puede suponer sin
  // medirla, así que un umbral en metros sería inventado. `pxPorMetro` es
  // opcional y solo sirve para escribir el desplazamiento en metros en el
  // mensaje; si es null, no se publica ninguna cifra en metros.
  pxPorMetro: null,
  velNetaMinPxS: 6.0, // 3,8 % del ancho de la rejilla por segundo
  linealidadMin: 0.42, // por debajo el rastro se da la vuelta, como una boya
  duracionMinS: 1.1, // rastro más corto que puede ser de una persona
  // Recorrido mínimo para llamarlo ola y no un simple avance. Es la señal que
  // separa a quien coge una ola de quien rema hacia ella o da vueltas en el pico.
  olaNetoMinPx: 24.0, // 15 % del ancho de la rejilla
  cuadrosPorSegundo: 10, // ritmo de análisis; el motor no lo usa, el llamante sí

  // Rechazos (más alto = más conservador).
  boyaNetoMaxPx: 6.0, // oscila en el sitio
  boyaLinealidadMax: 0.55,
  espumaVidaMaxS: 0.85, // destello de espuma o reflejo
  quietoNetoMaxPx: 8.0, // surfista esperando la serie
  paddleNetoMaxPx: 24.0, // se mueve pero no recorre: está remando

  // La confianza nunca llega a 1: es una estimación, no una medida.
  confianzaMax: 0.93,
};

const normalizar = (v, lo, hi) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));

// ------------------------------------------------------------------ geometría

// Ejes principales por momentos de segundo orden (covarianza 2x2). Barato, sin
// librerías, y suficiente para decir si un blob es una tabla tendida o alguien de
// pie. El eje no tiene signo, así que el ángulo se reduce a 0-180 grados.
export function ejesBlob(m00, m01, m11) {
  const tr = m00 + m11;
  const det = m00 * m11 - m01 * m01;
  const raiz = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const lambda1 = tr / 2 + raiz;
  const lambda2 = Math.max(0, tr / 2 - raiz);
  const angulo = 0.5 * Math.atan2(2 * m01, m00 - m11) * (180 / Math.PI);
  return {
    ejeMayor: Math.sqrt(Math.max(0, lambda1)),
    ejeMenor: Math.sqrt(Math.max(0, lambda2)),
    angulo: ((angulo % 180) + 180) % 180,
  };
}

// Componentes conexas de 8 vecinos sobre una máscara binaria. Iterativo, con una
// pila explícita: evita recursión y no reserva memoria por grupo.
export function componentes(mascara, ancho, alto, areaMin = 1) {
  const visto = new Uint8Array(mascara.length);
  const pila = new Int32Array(mascara.length);
  const salida = [];
  for (let inicio = 0; inicio < mascara.length; inicio++) {
    if (!mascara[inicio] || visto[inicio]) continue;
    let cima = 0;
    pila[cima++] = inicio;
    visto[inicio] = 1;
    const grupo = [];
    while (cima > 0) {
      const p = pila[--cima];
      grupo.push(p);
      const x = p % ancho;
      const y = (p / ancho) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= alto) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= ancho) continue;
          const q = ny * ancho + nx;
          if (mascara[q] && !visto[q]) { visto[q] = 1; pila[cima++] = q; }
        }
      }
    }
    if (grupo.length >= areaMin) salida.push(grupo);
  }
  return salida;
}

// Métricas de un grupo de píxeles. Guarda además la extensión horizontal real de
// cada fila, que es lo que permite separar la tabla (ancha y fina) de la persona
// (alta y estrecha) cuando salen como un solo blob.
export function medirBlob(grupo, ancho, alto) {
  const area = grupo.length;
  let sx = 0, sy = 0;
  let xMin = ancho, xMax = -1, yMin = alto, yMax = -1;
  const filas = new Int32Array(alto);
  const filaXMin = new Int32Array(alto).fill(ancho);
  const filaXMax = new Int32Array(alto).fill(-1);
  for (const p of grupo) {
    const x = p % ancho;
    const y = (p / ancho) | 0;
    sx += x; sy += y;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    filas[y]++;
    if (x < filaXMin[y]) filaXMin[y] = x;
    if (x > filaXMax[y]) filaXMax[y] = x;
  }
  const cx = sx / area, cy = sy / area;
  let m00 = 0, m01 = 0, m11 = 0;
  for (const p of grupo) {
    const dx = (p % ancho) - cx, dy = ((p / ancho) | 0) - cy;
    m00 += dx * dx; m01 += dx * dy; m11 += dy * dy;
  }
  const ejes = ejesBlob(m00, m01, m11);
  return {
    area, cx, cy,
    xMin, xMax, yMin, yMax,
    anchoPx: xMax - xMin + 1,
    altoPx: yMax - yMin + 1,
    ejeMayor: ejes.ejeMayor,
    ejeMenor: ejes.ejeMenor,
    elongacion: ejes.ejeMenor > 0.01 ? ejes.ejeMayor / ejes.ejeMenor : 99,
    angulo: ejes.angulo,
    filas, filaXMin, filaXMax,
  };
}

// ------------------------------------------------------------------ persona/tabla

// ¿Este blob puede ser una persona? Vertical y con altura suficiente.
export function esPersona(blob, a) {
  if (!blob) return false;
  if (blob.altoPx < Math.max(2, a.alturaMinPersonaFrac * a.altoAnalisis)) return false;
  return blob.altoPx >= blob.anchoPx * a.altoSobreAnchoPersona;
}

// ¿Este blob puede ser una tabla? Tendida, alargada y fina.
export function esTabla(blob, a, ancho) {
  if (!blob) return false;
  if (blob.anchoPx < Math.max(2, a.anchoTablaMinFrac * ancho)) return false;
  if (blob.altoPx > a.grosorTablaMaxFrac * a.altoAnalisis) return false;
  if (blob.elongacion < a.elongacionTablaMin) return false;
  const desvio = Math.min(Math.abs(blob.angulo), Math.abs(180 - blob.angulo));
  return desvio <= a.desvioHorizontalMaxGrados;
}

// Una persona y una tabla pueden salir como dos blobs separados (cuando se ve un
// hueco entre las piernas y la tabla) o como uno solo, que es lo normal: las
// piernas apoyan en la tabla y todo queda pegado. Para ese caso se parte la
// silueta en la banda ancha y fina de la tabla y en lo que queda encima.
export function buscarPersonaYTabla(blobs, a, ancho) {
  let mejor = null;
  const puntua = (persona, tabla, juntos) => {
    const d = Math.hypot(persona.cx - tabla.cx, persona.cy - tabla.cy);
    const escala = Math.max(1, persona.altoPx) * a.contactoMaxFrac;
    if (d > escala) return;
    const p = { persona, tabla, juntos, contacto: 1 - d / escala };
    if (!mejor || p.contacto > mejor.contacto) mejor = p;
  };

  for (const bp of blobs) {
    // Caso 1: la persona es un blob propio y la tabla otro.
    if (esPersona(bp, a)) {
      for (const bt of blobs) {
        if (bt === bp || !esTabla(bt, a, ancho)) continue;
        puntua(bp, bt, false);
      }
    }
    // Caso 2: silueta única. La tabla se busca dentro y la persona es lo que
    // sobresale por encima de ella.
    for (const par of descomponerSilueta(bp, a)) {
      puntua(par.persona, par.tabla, true);
    }
  }
  return mejor;
}

// Separa un blob en (lo que hay encima = persona, banda ancha y fina = tabla).
function descomponerSilueta(b, a) {
  const salida = [];
  const alturaMin = Math.max(2, a.alturaMinPersonaFrac * a.altoAnalisis);
  for (const banda of bandasDeTabla(b, a)) {
    const yArribaFin = banda.yMin - 1;
    if (yArribaFin < b.yMin) continue;
    const altoPx = yArribaFin - b.yMin + 1;
    if (altoPx < alturaMin) continue;
    let anchoPx = 0, sx = 0, area = 0;
    for (let y = b.yMin; y <= yArribaFin; y++) {
      const w = b.filaXMax[y] - b.filaXMin[y] + 1;
      if (w > 0 && b.filas[y] > 0) {
        anchoPx = Math.max(anchoPx, w);
        sx += (b.filaXMin[y] + b.filaXMax[y]) / 2;
        area += b.filas[y];
      }
    }
    if (!area || altoPx < anchoPx * a.altoSobreAnchoPersona) continue;
    salida.push({
      persona: {
        area, cx: sx / (yArribaFin - b.yMin + 1), cy: (b.yMin + yArribaFin) / 2,
        xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: yArribaFin,
        anchoPx, altoPx,
        ejeMayor: altoPx, ejeMenor: anchoPx,
        elongacion: anchoPx > 0.01 ? altoPx / anchoPx : 99,
        angulo: 90,
      },
      tabla: banda,
    });
  }
  return salida;
}

// Bandas horizontales anchas y finas dentro de un blob: así se ve la tabla en la
// silueta de un surfista tumbado o de pie sobre ella.
function bandasDeTabla(b, a) {
  const salida = [];
  const anchoMinBanda = Math.max(2, a.anchoTablaMinFrac * a.anchoAnalisis);
  const grosorMax = a.grosorTablaMaxFrac * a.altoAnalisis;
  let y = b.yMin;
  while (y <= b.yMax) {
    if (b.filas[y] < anchoMinBanda) { y++; continue; }
    let fin = y;
    while (fin + 1 <= b.yMax && b.filas[fin + 1] >= anchoMinBanda) fin++;
    const grosor = fin - y + 1;
    const x0 = b.filaXMin[y], x1 = b.filaXMax[y];
    const anchoPx = x1 - x0 + 1;
    if (grosor <= grosorMax && anchoPx >= b.anchoPx * 0.6) {
      let sx = 0;
      for (let yy = y; yy <= fin; yy++) sx += (b.filaXMin[yy] + b.filaXMax[yy]) / 2;
      salida.push({
        area: grosor * anchoPx,
        cx: sx / grosor, cy: (y + fin) / 2,
        xMin: x0, xMax: x1, yMin: y, yMax: fin,
        anchoPx, altoPx: grosor,
        ejeMayor: anchoPx, ejeMenor: grosor,
        elongacion: grosor > 0.01 ? anchoPx / grosor : 99,
        angulo: 0,
      });
      y = fin + 1;
    } else {
      y = fin + 1;
    }
  }
  return salida;
}

// -------------------------------------------------------------- clasificación

// Clasifica una trayectoria ya medida. Está separada del resto del motor para
// poder probarla con datos sintéticos sin tocar píxeles, que es como se
// comprueban los rechazos de boya, bañista, espuma y surfista quieto.
export function clasificarOla(track, a = AJUSTES_DETECCION) {
  const res = {
    esOla: false, tipo: "sin_candidato", confianza: 0,
    motivos: [], falta: [], medida: {},
  };
  if (!track || track.length < a.cuadrosMinimos) {
    res.tipo = "informe";
    res.motivos.push("Muy pocos fotogramas para seguir a nadie.");
    return res;
  }
  const ultimo = track[track.length - 1];
  const tFin = ultimo.t / 1000;
  const ventana = track.filter((p) => p.t / 1000 >= tFin - a.ventanaS);
  const ini = ventana.length >= a.cuadrosMinimos ? ventana[0] : track[0];
  const fin = ventana[ventana.length - 1];

  const dx = fin.x - ini.x, dy = fin.y - ini.y;
  const netoPx = Math.hypot(dx, dy);
  let recorrido = 0;
  for (let i = 1; i < ventana.length; i++) {
    recorrido += Math.hypot(ventana[i].x - ventana[i - 1].x, ventana[i].y - ventana[i - 1].y);
  }
  const durVentana = (fin.t - ini.t) / 1000 || 1e-3;
  const velNetaPxS = netoPx / durVentana;
  const velMediaPxS = recorrido / durVentana;
  const linealidad = recorrido > 0.5 ? netoPx / recorrido : 0;
  const metros = (px) => (a.pxPorMetro ? +(px / a.pxPorMetro).toFixed(2) : null);

  // Dirección de avance y relación con el eje de la tabla.
  const angMov = (Math.atan2(dy, dx) * 180) / Math.PI;
  const angTabla = fin.tabla ? fin.tabla.angulo : 0;
  const dif = Math.abs(((((angMov - angTabla) % 180) + 180) % 180));
  const difCorto = Math.min(dif, 180 - dif);
  const perpendicular = Math.sin((difCorto * Math.PI) / 180);
  const paralelo = Math.cos((difCorto * Math.PI) / 180);

  res.medida = {
    duracion: +durVentana.toFixed(2),
    netoPx: +netoPx.toFixed(1),
    recorridoPx: +recorrido.toFixed(1),
    velNetaPxS: +velNetaPxS.toFixed(1),
    velMediaPxS: +velMediaPxS.toFixed(1),
    linealidad: +linealidad.toFixed(2),
    perpendicularidad: +perpendicular.toFixed(2),
    paralelismo: +paralelo.toFixed(2),
    angMov: +(((angMov % 360) + 360) % 360).toFixed(1),
    angTabla: +angTabla.toFixed(1),
    area: fin.area,
    alturaPx: fin.altoPx,
    anchoRejilla: a.anchoAnalisis,
    pixelesPorMetro: a.pxPorMetro || null,
    netoM: metros(netoPx),
    velNetaMs: a.pxPorMetro ? +((netoPx / a.pxPorMetro) / durVentana).toFixed(2) : null,
  };

  // 1. Persona: sin ella no hay surfista, por muy rápido que vaya el objeto. Es
//    aquí donde caen de cabeza las boyas, la espuma oscura y los reflejos, así
//    que se nombran según cómo se mueven para que el informe diga la verdad.
  if (!fin.persona) {
    if (netoPx < a.boyaNetoMaxPx && linealidad < a.boyaLinealidadMax) {
      res.tipo = "boya";
      res.motivos.push(`Oscila en el sitio: ${netoPx.toFixed(1)} px netos y linealidad ${linealidad.toFixed(2)}, y no hay nadie de pie encima.`);
    } else {
      res.tipo = "sin_persona";
      res.motivos.push(
        "No hay una forma vertical pegada a la tabla: se mueve, pero no hay nadie de pie sobre ella."
      );
    }
    return res;
  }
  // 2. Tabla: alguien de pie en la orilla no es un surfista en el agua.
  if (!fin.tabla) {
    res.tipo = "banista";
    res.motivos.push("Hay una forma vertical pero no ninguna tabla tendida al lado: encaja con bañista.");
    return res;
  }
  // 3. Rastro demasiado corto para una persona. La espuma de verdad ya ni
  //    llega aquí: es más clara que el fondo y el motor la cuenta aparte, así
  //    que este es el segundo filtro por si acaso.
  if (durVentana < a.espumaVidaMaxS) {
    res.tipo = "espuma";
    res.motivos.push(`Solo ${durVentana.toFixed(2)} s de rastro con persona y tabla: no da tiempo a que sea alguien de verdad.`);
    return res;
  }
  // 4. Persona y tabla, pero sin apenas desplazamiento: surfista quieto
  //    esperando la serie en el pico. No se llama boya porque hay alguien encima.
  if (netoPx < a.quietoNetoMaxPx) {
    res.tipo = "surfista_espera";
    res.motivos.push(`Persona y tabla, pero apenas se ha movido (${netoPx.toFixed(1)} px): está quieta esperando la serie.`);
    return res;
  }

  const falta = [];
  // 5. Movimiento real y sostenido.
  if (velNetaPxS < a.velNetaMinPxS) {
    falta.push(`avance lento (${velNetaPxS.toFixed(1)} px/s, se piden ${a.velNetaMinPxS})`);
  }
  if (linealidad < a.linealidadMin) {
    falta.push(`trayectoria errática (linealidad ${linealidad.toFixed(2)}, se pide ${a.linealidadMin})`);
  }
  if (durVentana < a.duracionMinS) {
    falta.push(`rastro corto (${durVentana.toFixed(2)} s, se piden ${a.duracionMinS})`);
  }
  // 6. Ha recorrido la rompiente o solo se ha movido por el sitio: esta es la
  //    señal que separa a quien coge la ola de quien rema hacia ella.
  if (netoPx < a.paddleNetoMaxPx) {
    res.tipo = "remando";
    res.motivos.push(
      `Persona y tabla en movimiento, pero solo recorre ${netoPx.toFixed(1)} px en la ventana ` +
      `(se piden ${a.paddleNetoMaxPx}): está remando o dando vueltas, no cogiendo una ola.`
    );
    res.falta = [...falta, `recorrido corto (${netoPx.toFixed(1)} px < ${a.paddleNetoMaxPx} px)`];
    return res;
  }
  if (netoPx < a.olaNetoMinPx) {
    falta.push(`recorrido de ola corto (${netoPx.toFixed(1)} px, se piden ${a.olaNetoMinPx})`);
  }

  if (falta.length) {
    res.tipo = "candidato_insuficiente";
    res.motivos.push("Le faltan señales para llamarlo ola: " + falta.join("; ") + ".");
    res.falta = falta;
    return res;
  }

  res.esOla = true;
  res.tipo = "coge_ola";
  res.confianza = +(
    a.confianzaMax *
    (0.50 +
      0.20 * normalizar(linealidad, a.linealidadMin, 0.9) +
      0.18 * normalizar(netoPx, a.olaNetoMinPx, a.olaNetoMinPx * 2.5) +
      0.12 * normalizar(durVentana, a.duracionMinS, a.duracionMinS * 3))
  ).toFixed(2);
  if (res.confianza > a.confianzaMax) res.confianza = a.confianzaMax;
  res.motivos.push(
    `Persona y tabla con avance sostenido de ${velNetaPxS.toFixed(1)} px/s durante ` +
    `${durVentana.toFixed(2)} s: ${netoPx.toFixed(0)} px netos (linealidad ${linealidad.toFixed(2)})` +
    (a.pxPorMetro ? ` = ${(netoPx / a.pxPorMetro).toFixed(1)} m` : "") +
    `. Ángulo tabla/avance ${difCorto.toFixed(0)}° (informativo, no decide).`
  );
  return res;
}

// ------------------------------------------------------------------- motor

// Encadena: fondo temporal -> máscara por polaridad -> componentes ->
// emparejamiento persona/tabla -> seguimiento -> clasificación.
export function crearDetector(opciones = {}) {
  const a = { ...AJUSTES_DETECCION, ...opciones };
  const W = a.anchoAnalisis, H = a.altoAnalisis;
  const fondo = new Float32Array(W * H);
  const alpha = 1 / Math.max(1, a.cuadrosFondo);
  const yAgua0 = Math.floor(a.roiAgua[0] * H);
  const yAgua1 = Math.ceil(a.roiAgua[1] * H);
  const tracks = new Map();
  const eventos = [];
  let siguiente = 1;
  let cuadros = 0;
  let fondoListo = false;

  function fueraDeAgua(y) { return y < yAgua0 || y > yAgua1; }

  function push(gris, tMs) {
    if (!gris || gris.length < W * H) return null;
    const oscuro = new Uint8Array(W * H);
    const claro = new Uint8Array(W * H);

    if (!fondoListo) {
      for (let p = 0; p < W * H; p++) fondo[p] = gris[p];
      fondoListo = true;
      cuadros++;
      return { t: tMs, deteccion: null, espumaPx: 0, tracks: 0, primerCuadro: true };
    }

    let pixelesClaros = 0;
    for (let p = 0; p < W * H; p++) {
      const d = gris[p] - fondo[p];
      if (d <= -a.contrasteOscuro) oscuro[p] = 1;
      else if (d >= a.contrasteClaro) claro[p] = 1;
    }
    // Media móvil exponencial: el fondo sigue la luz despacio, así que una
    // espuma de medio segundo no se le escapa y no borra al surfista.
    for (let p = 0; p < W * H; p++) fondo[p] += (gris[p] - fondo[p]) * alpha;
    cuadros++;

    const blobs = componentes(oscuro, W, H, a.areaMinPx)
      .map((g) => medirBlob(g, W, H))
      .filter((b) => b.altoPx >= a.altoMinPersonaFrac * H && !fueraDeAgua(b.cy));
    const espumaPx = componentes(claro, W, H, 1).reduce((s, g) => s + g.length, 0);
    pixelesClaros = espumaPx;

    const par = buscarPersonaYTabla(blobs, a, W);

    // Emparejar el candidato con el track vivo más cercano.
    if (par) {
      const cx = par.persona.cx, cy = par.persona.cy;
      let elegido = null, mejorDist = a.radioAsociacionFrac * W;
      for (const [id, tr] of tracks) {
        const d = Math.hypot(tr.pts[tr.pts.length - 1].x - cx, tr.pts[tr.pts.length - 1].y - cy);
        if (d < mejorDist) { mejorDist = d; elegido = id; }
      }
      const punto = {
        t: tMs, x: cx, y: cy,
        area: par.persona.area,
        altoPx: par.persona.altoPx,
        persona: {
          cx, cy,
          altoPx: par.persona.altoPx,
          angulo: par.persona.angulo,
        },
        tabla: {
          cx: par.tabla.cx, cy: par.tabla.cy,
          angulo: par.tabla.angulo,
          elongacion: par.tabla.elongacion,
          anchoPx: par.tabla.anchoPx,
        },
      };
      if (elegido) {
        const tr = tracks.get(elegido);
        tr.pts.push(punto);
        tr.missed = 0;
      } else {
        tracks.set(siguiente, { pts: [punto], missed: 0 });
        siguiente++;
      }
    }

    // Clasificar los tracks y caducar los que llevan mucho sin verse.
    let deteccion = null;
    for (const [id, tr] of [...tracks]) {
      tr.missed++;
      if (tr.missed > a.cuadrosMinimos * 3) { tracks.delete(id); continue; }
      if (tr.pts.length < a.cuadrosMinimos) continue;
      const clas = clasificarOla(tr.pts, a);
      if (clas.esOla) {
        deteccion = {
          tipo: clas.tipo,
          esOla: true,
          confianza: clas.confianza,
          tMs,
          medida: clas.medida,
          motivos: clas.motivos,
          espumaPx: pixelesClaros,
        };
        eventos.push(deteccion);
        tracks.delete(id);
        break;
      }
    }

    return { t: tMs, deteccion, espumaPx: pixelesClaros, tracks: tracks.size };
  }

  return {
    ajustes: a,
    push,
    estado: () => ({ tracks: tracks.size, cuadros, eventos: eventos.length }),
    ultimoEvento: () => eventos[eventos.length - 1] || null,
    eventos: () => eventos.slice(),
    reset() {
      fondo.fill(0);
      fondoListo = false;
      tracks.clear();
      eventos.length = 0;
      cuadros = 0;
      siguiente = 1;
    },
  };
}

// ------------------------------------------------------------------ utilidades

// Convierte un fotograma RGBA de un canvas en la rejilla de análisis en escala de
// grises, con promediado por bloques. Devuelve un Uint8Array de ancho*alto.
export function aGrisesReducidos(rgba, anchoOrig, altoOrig, anchoDest, altoDest) {
  const salida = new Uint8Array(anchoDest * altoDest);
  const pasoX = anchoOrig / anchoDest;
  const pasoY = altoOrig / altoDest;
  for (let y = 0; y < altoDest; y++) {
    const y0 = Math.floor(y * pasoY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * pasoY));
    for (let x = 0; x < anchoDest; x++) {
      const x0 = Math.floor(x * pasoX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * pasoX));
      let suma = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < altoOrig; yy++) {
        let p = (yy * anchoOrig + x0) * 4;
        for (let xx = x0; xx < x1 && xx < anchoOrig; xx++) {
          suma += 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
          p += 4;
          n++;
        }
      }
      salida[y * anchoDest + x] = n ? suma / n : 0;
    }
  }
  return salida;
}