// assistant.js — Forecaster local: informes y respuestas en español sobre la previsión de surf,
// calculados en el navegador a partir de los datos ya descargados (fc). Sin APIs externas ni claves.

import { compass, RATINGS, nowIndex, tideExtremes } from './forecast.js';

// ---------- Texto y formato ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(s).toLowerCase().trim();
const p = (text) => `<p>${esc(text)}</p>`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW_NORM = DOW.map(norm);
const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Nombre corto de un día: hoy / mañana / pasado mañana / nombre del día de la semana
const dayLabel = (date, i) => {
  if (i === 0) return 'hoy';
  if (i === 1) return 'mañana';
  if (i === 2) return 'pasado mañana';
  return DOW[new Date(`${date}T12:00:00`).getDay()];
};
// Nombre con fecha entre paréntesis, para el parte y las listas
const dayFull = (date, i) => {
  const d = new Date(`${date}T12:00:00`);
  return `${dayLabel(date, i)} (${d.getDate()} de ${MON[d.getMonth()]})`;
};

const fmtM = (x) => (x == null ? '–' : x.toFixed(1));
// Rango de altura al estilo de la app (mismo redondeo que app.js)
function fmtRange(min, max) {
  if (min == null || max == null) return '–';
  const a = Math.max(0, Math.round(min * 10) / 10);
  const b = Math.round(max * 10) / 10;
  if (b < 0.2) return '0–0.2';
  return a === b ? `${a}` : `${a}–${b}`;
}
const ratingWord = (r) => (r == null || isNaN(r) ? 'sin datos' : (RATINGS[r]?.label ?? '–'));
const kmh = (x) => (x == null || isNaN(x) ? '–' : Math.round(x) + ' km/h');
const topSwell = (h) => h?.swells?.[0] ?? null;

// Traje según temperatura del agua
function wetsuitFor(t) {
  if (t == null) return 'neopreno según época';
  if (t >= 24) return 'licra';
  if (t >= 21) return 'shorty (2 mm)';
  if (t >= 18) return '3/2 mm';
  if (t >= 15) return '4/3 mm';
  return '5/4 mm con escarpines';
}
// Tabla recomendada según el tamaño del día
function boardFor(maxSize) {
  if (maxSize == null) return 'habitual';
  if (maxSize < 0.5) return 'evolutiva o tablón';
  if (maxSize < 1) return 'evolutiva o shortboard con volumen';
  return 'tabla corta';
}

// Etiqueta de viento más repetida en un grupo de horas
function dominantWindLabel(hs) {
  if (!hs.length) return '–';
  const count = {};
  hs.forEach((h) => { count[h.wind.label] = (count[h.wind.label] || 0) + 1; });
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- Interpretación de la pregunta ----------

// Detecta qué spots menciona la pregunta, por nombre o por zona, tolerando tildes/mayúsculas.
// Devuelve los spots en el orden en que aparecen mencionados.
function detectSpots(question, spots) {
  const q = norm(question);
  const byName = [];
  for (const s of spots) {
    const name = norm(s.name);
    if (!name) continue;
    const tokens = name.split(/\s+/).filter((t) => t.length >= 4);
    let pos = q.indexOf(name);
    if (pos < 0) { for (const t of tokens) { const i = q.indexOf(t); if (i >= 0) { pos = i; break; } } }
    if (pos >= 0) byName.push({ s, pos });
  }
  if (byName.length) return byName.sort((a, b) => a.pos - b.pos).map((x) => x.s);

  const byZone = [];
  for (const s of spots) {
    const zone = norm(s.zoneName || '');
    if (!zone) continue;
    const tokens = zone.split(/\s+/).filter((t) => t.length >= 4);
    let pos = q.indexOf(zone);
    if (pos < 0) { for (const t of tokens) { const i = q.indexOf(t); if (i >= 0) { pos = i; break; } } }
    if (pos >= 0) byZone.push({ s, pos });
  }
  return byZone.sort((a, b) => a.pos - b.pos).map((x) => x.s);
}

// Día mencionado: hoy, mañana, pasado mañana, día de la semana, finde o esta semana
function parseDay(q) {
  if (/pasado\s*manana/.test(q)) return { idx: 2 };
  if (/\bfinde\b|\bfin de semana\b/.test(q)) return { range: 'weekend' };
  if (/\besta semana\b/.test(q)) return { range: 'week' };
  if (/\bhoy\b/.test(q)) return { idx: 0 };
  if (/\bmanana\b/.test(q)) return { idx: 1 };
  for (let i = 1; i < DOW_NORM.length; i++) {
    if (new RegExp(`\\b${DOW_NORM[i]}\\b`).test(q)) return { weekday: i };
  }
  if (new RegExp(`\\b${DOW_NORM[0]}\\b`).test(q)) return { weekday: 0 };
  return null;
}

// Franja horaria y día mencionados, evitando que "mañana" de "por la mañana" cuente como el día siguiente
function parseQuery(question) {
  const q = norm(question);
  let qForDay = q;
  let franja = null;
  const hourMatch = q.match(/\ba las?\s+(\d{1,2})\b/);
  if (hourMatch) {
    const hh = Math.min(23, parseInt(hourMatch[1], 10));
    franja = { from: hh, to: hh, exact: true };
    qForDay = qForDay.replace(hourMatch[0], ' ');
  } else if (/\bmediodia\b/.test(q)) {
    franja = { from: 12, to: 15 };
  } else {
    const tardeMatch = q.match(/(?:por|de|a) la tarde\b/);
    const mananaMatch = q.match(/(?:por|de|a) la manana\b/);
    if (tardeMatch) { franja = { from: 15, to: 21 }; qForDay = qForDay.replace(tardeMatch[0], ' '); }
    else if (mananaMatch) { franja = { from: 7, to: 12 }; qForDay = qForDay.replace(mananaMatch[0], ' '); }
  }
  return { franja, day: parseDay(qForDay), wantNow: /\bahora\b/.test(q) };
}

// Resuelve un día mencionado al índice dentro de days (0 = hoy)
function resolveDayIdx(days, dayInfo, fallback = 0) {
  if (!dayInfo) return fallback;
  if (dayInfo.idx != null) return Math.min(dayInfo.idx, days.length - 1);
  if (dayInfo.weekday != null) {
    for (let i = 0; i < days.length; i++) {
      if (new Date(`${days[i].date}T12:00:00`).getDay() === dayInfo.weekday) return i;
    }
    return fallback;
  }
  if (dayInfo.range) return resolveDayRange(days, dayInfo)[0];
  return fallback;
}

// Resuelve un rango de días (finde, esta semana) a [inicio, fin]
function resolveDayRange(days, dayInfo) {
  if (!dayInfo) return [0, Math.min(6, days.length - 1)];
  if (dayInfo.idx != null) { const i = Math.min(dayInfo.idx, days.length - 1); return [i, i]; }
  if (dayInfo.weekday != null) { const i = resolveDayIdx(days, dayInfo, 0); return [i, i]; }
  if (dayInfo.range === 'week') return [0, Math.min(6, days.length - 1)];
  if (dayInfo.range === 'weekend') {
    let sat = -1;
    for (let i = 0; i < days.length; i++) {
      if (new Date(`${days[i].date}T12:00:00`).getDay() === 6) { sat = i; break; }
    }
    if (sat < 0) return [0, Math.min(1, days.length - 1)];
    const sunIsNext = sat + 1 < days.length && new Date(`${days[sat + 1].date}T12:00:00`).getDay() === 0;
    return [sat, sunIsNext ? sat + 1 : sat];
  }
  return [0, Math.min(6, days.length - 1)];
}

const dayIndexOf = (f, date) => f.days.findIndex((d) => d.date === date);
const firstAvailable = (fc, spots) => { for (const s of spots) if (fc.spots[s.id]) return fc.spots[s.id]; return null; };

function suggestionsHtml(intro) {
  return `<p>${esc(intro)}</p><ul>${suggestions().map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}

// ---------- Ventanas buenas ----------

// Ventanas con rating >= minRating en horas de luz (7-21h), agrupando horas consecutivas.
// Devuelve un array ordenado por calidad (mejor primero) — lo usa también la portada.
export function bestWindows(fc, spots, { days = 4, minRating = 3 } = {}) {
  const out = [];
  for (const spot of spots) {
    const f = fc.spots[spot.id];
    if (!f) continue;
    const n = Math.min(days, f.days.length);
    const nowKey = f.hours[nowIndex(f.hours)].time;
    for (let di = 0; di < n; di++) {
      const day = f.days[di];
      // Solo horas de luz que aún no han pasado
      const daylight = day.hours.filter((h) => h.hour >= 7 && h.hour <= 21 && h.time >= nowKey);
      let win = null;
      const flush = () => {
        if (!win) return;
        out.push({
          spotId: spot.id,
          date: day.date,
          from: win.from,
          to: win.to + 1,
          rating: win.rating,
          surfMin: Math.min(...win.hs.map((h) => h.surf?.min ?? 0)),
          surfMax: Math.max(...win.hs.map((h) => h.surf?.max ?? 0)),
          windLabel: dominantWindLabel(win.hs)
        });
        win = null;
      };
      daylight.forEach((h) => {
        if (h.rating != null && !isNaN(h.rating) && h.rating >= minRating && (h.surf?.mid ?? 0) >= 0.35) {
          // Un cambio de calidad abre una ventana nueva para dar franjas concretas
          if (win && h.rating !== win.rating) flush();
          if (!win) win = { from: h.hour, to: h.hour, rating: h.rating, hs: [h] };
          else { win.to = h.hour; win.hs.push(h); }
        } else flush();
      });
      flush();
    }
  }
  out.sort((a, b) => b.rating - a.rating || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.from - b.from);
  return out;
}

// ---------- Parte regional ----------

function describeWindShort(morning, afternoon) {
  const avg = (hs) => (hs.length ? Math.round(hs.reduce((a, h) => a + h.windSpeed, 0) / hs.length) : null);
  const mLabel = dominantWindLabel(morning), aLabel = dominantWindLabel(afternoon);
  const mSpeed = avg(morning), aSpeed = avg(afternoon);
  if (!morning.length || !afternoon.length) return '';
  const fmt = (lbl, spd) => {
    if (lbl === 'Calma') return 'calma';
    if (spd != null && spd < 12) return `${lbl.toLowerCase()} flojo`;
    return spd != null ? `${lbl.toLowerCase()} ${spd} km/h` : lbl.toLowerCase();
  };
  if (mLabel === aLabel) return fmt(mLabel, mSpeed);
  return `${fmt(mLabel, mSpeed)} mañana, ${fmt(aLabel, aSpeed)} tarde`;
}

function daySummaryParagraph(fc, spots, dayIdx, label) {
  let best = null;
  for (const s of spots) {
    const day = fc.spots[s.id]?.days[dayIdx];
    if (!day) continue;
    if (!best || day.rating > best.day.rating || (day.rating === best.day.rating && day.surfMax > best.day.surfMax)) best = { s, day };
  }
  if (!best) return '';
  const { s, day } = best;
  const sw = topSwell(day.best);
  const swTxt = sw?.dir != null && sw?.t != null ? ` ${compass(sw.dir)} ${Math.round(sw.t)} s` : '';
  const morning = day.hours.filter((h) => h.hour >= 7 && h.hour < 13);
  const afternoon = day.hours.filter((h) => h.hour >= 13 && h.hour <= 20);
  const windTxt = describeWindShort(morning, afternoon);
  const windows = bestWindows(fc, spots, { days: dayIdx + 1, minRating: 3 }).filter((w) => w.date === day.date);
  let windowTxt = 'Sin ventanas claras.';
  if (windows.length) {
    const names = [...new Set(windows.slice(0, 2).map((w) => spots.find((x) => x.id === w.spotId)?.name ?? w.spotId))];
    windowTxt = `Mejor ${windows[0].from}–${windows[0].to} h en ${esc(names.join(' y '))}.`;
  } else if (day.rating >= 3) {
    windowTxt = `Mejor sobre las ${day.best.hour}:00 en ${esc(s.name)}.`;
  }
  const windPart = windTxt ? `, ${windTxt}. ` : '. ';
  return `<p><b>${label}:</b> ${fmtRange(day.surfMin, day.surfMax)} m${swTxt}${windPart}${windowTxt}</p>`;
}

function nextDaysParagraph(fc, spots, idxs) {
  const bits = idxs.map((i) => {
    let best = null;
    for (const s of spots) {
      const day = fc.spots[s.id]?.days[i];
      if (!day) continue;
      if (!best || day.rating > best.day.rating) best = { s, day };
    }
    if (!best) return null;
    return `${esc(dayLabel(best.day.date, i))} ${fmtRange(best.day.surfMin, best.day.surfMax)} m en ${esc(best.s.name)} (${esc(ratingWord(best.day.rating))})`;
  }).filter(Boolean);
  return bits.length ? `<p><b>Próximos días:</b> ${bits.join('; ')}.</p>` : '';
}

function trendParagraph(fc, spots, idxs, ref) {
  const peaks = idxs.map((i) => ({ i, day: ref.days[i] })).filter(({ day }) => day && day.rating != null && day.rating >= 5 && (day.surfMax ?? 0) >= 0.7);
  if (!peaks.length) {
    const mins = idxs.map((i) => ref.days[i]?.surfMin).filter((v) => v != null);
    const maxs = idxs.map((i) => ref.days[i]?.surfMax).filter((v) => v != null);
    const range = mins.length ? fmtRange(Math.min(...mins), Math.max(...maxs)) : '–';
    return `<p><b>Tendencia:</b> Sin repuntes claros (${range} m).</p>`;
  }
  const txt = peaks.slice(0, 2).map(({ i, day }) => `${esc(dayLabel(day.date, i))} (${fmtRange(day.surfMin, day.surfMax)} m)`).join(', ');
  return `<p><b>Tendencia:</b> Repuntes probables ${txt}.</p>`;
}

// Parte escrito para toda la costa: hoy, mañana, próximos días y tendencia a 15 días
export function regionReport(fc, spots) {
  const withData = spots.filter((s) => fc.spots[s.id]);
  if (!withData.length) return p('Sin previsión cargada.');
  const ref = fc.spots[withData[0].id];
  const parts = [];
  parts.push(daySummaryParagraph(fc, withData, 0, 'Hoy'));
  if (ref.days[1]) parts.push(daySummaryParagraph(fc, withData, 1, 'Mañana'));
  const nextIdxs = [2, 3].filter((i) => ref.days[i]);
  if (nextIdxs.length) parts.push(nextDaysParagraph(fc, withData, nextIdxs));
  const trendIdxs = ref.days.map((_, i) => i).slice(4);
  if (trendIdxs.length) parts.push(trendParagraph(fc, withData, trendIdxs, ref));
  return parts.filter(Boolean).join('');
}

// ---------- Parte de un spot ----------

// Parte escrito de un spot: mejores ventanas, tabla recomendada y traje
export function spotReport(f) {
  const { spot, days } = f;
  if (!days.length) return p('Sin previsión cargada.');
  const wrap = { spots: { [spot.id]: f } };
  // Las cinco mejores franjas de los próximos 4 días, en orden de fecha
  const windows = bestWindows(wrap, [spot], { days: Math.min(4, days.length), minRating: 3 })
    .sort((a, b) => b.rating - a.rating || b.surfMax - a.surfMax)
    .slice(0, 5)
    .sort((a, b) => (a.date === b.date ? a.from - b.from : (a.date < b.date ? -1 : 1)));
  const windowsHtml = windows.length
    ? `<ul class="win-list">${windows.map((w) => `<li><span class="rating-pill r${w.rating}">${esc(ratingWord(w.rating))}</span> <b>${esc(cap(dayLabel(w.date, dayIndexOf(f, w.date))))} ${w.from}–${w.to} h</b> · ${fmtRange(w.surfMin, w.surfMax)} m · ${esc(w.windLabel.toLowerCase())}</li>`).join('')}</ul>`
    : '<p>Sin ventanas claras en 4 días.</p>';

  const today = days[0];
  const sst = today.hours.find((h) => h.sst != null)?.sst ?? null;
  const trajeTxt = sst != null ? ` Traje: ${wetsuitFor(sst)} (${Math.round(sst)} °C).` : '';
  return `<h3>Mejores ventanas · próximos 4 días</h3>${windowsHtml}` +
    `<h3 style="margin-top:12px">Recomendación</h3>` +
    `<p>Tabla: ${boardFor(today.surfMax)}.${trajeTxt}</p>`;
}

// ---------- Respuestas puntuales del chat ----------

function answerCompare(spotA, spotB, fc, dayInfo) {
  const fa = fc.spots[spotA.id], fb = fc.spots[spotB.id];
  if (!fa || !fb) return p('Faltan datos de algún spot.');
  const idx = resolveDayIdx(fa.days, dayInfo, 0);
  const da = fa.days[idx], db = fb.days[idx];
  if (!da || !db) return p('Sin previsión para ese día.');
  const winner = da.rating !== db.rating ? (da.rating > db.rating ? spotA : spotB) : (da.surfMax >= db.surfMax ? spotA : spotB);
  return `<p><b>${esc(cap(dayLabel(da.date, idx)))}:</b> Mejor <b>${esc(winner.name)}</b>.<br>` +
    `<b>${esc(spotA.name)}:</b> ${fmtRange(da.surfMin, da.surfMax)} m, ${esc(ratingWord(da.rating))}, ${esc(da.best.wind.label.toLowerCase())} ${kmh(da.best.windSpeed)}.<br>` +
    `<b>${esc(spotB.name)}:</b> ${fmtRange(db.surfMin, db.surfMax)} m, ${esc(ratingWord(db.rating))}, ${esc(db.best.wind.label.toLowerCase())} ${kmh(db.best.windSpeed)}.</p>`;
}

function answerBestSpot(fc, spots, dayInfo) {
  const ref = firstAvailable(fc, spots);
  if (!ref) return p('Sin previsión cargada.');
  const idx = resolveDayIdx(ref.days, dayInfo, 0);
  let best = null;
  for (const s of spots) {
    const day = fc.spots[s.id]?.days[idx];
    if (!day) continue;
    if (!best || day.rating > best.day.rating || (day.rating === best.day.rating && day.surfMax > best.day.surfMax)) best = { s, day };
  }
  if (!best) return p('Sin datos para ese día.');
  const { s, day } = best;
  return `<p><b>${esc(cap(dayLabel(day.date, idx)))}:</b> Mejor spot <b>${esc(s.name)}</b> (${esc(s.zoneName)}).<br>` +
    `${fmtRange(day.surfMin, day.surfMax)} m, ${esc(ratingWord(day.rating))}. Mejor a las ${day.best.hour}:00 (${esc(day.best.wind.label.toLowerCase())} ${kmh(day.best.windSpeed)}).</p>`;
}

function answerWhen(fc, targetSpots, dayInfo) {
  const ref = firstAvailable(fc, targetSpots);
  if (!ref) return p('Sin previsión cargada.');
  const range = resolveDayRange(ref.days, dayInfo);
  let windows = bestWindows(fc, targetSpots, { days: Math.min(ref.days.length, range[1] + 1), minRating: 3 })
    .filter((w) => { const i = dayIndexOf(ref, w.date); return i >= range[0] && i <= range[1]; });
  let note = '';
  if (!windows.length) {
    const further = bestWindows(fc, targetSpots, { days: ref.days.length, minRating: 3 })
      .filter((w) => dayIndexOf(ref, w.date) > range[1]);
    if (further.length) { windows = [further[0]]; note = 'Sin ventanas en esas fechas. Próxima opción:'; }
  }
  if (!windows.length) return p('Sin ventanas claras en los próximos días.');
  const nameOf = (id) => targetSpots.find((s) => s.id === id)?.name ?? id;
  const groups = new Map();
  for (const w of windows) {
    const k = `${w.date}|${w.from}|${w.to}|${w.rating}`;
    if (!groups.has(k)) groups.set(k, { ...w, names: [] });
    const g = groups.get(k);
    g.names.push(nameOf(w.spotId));
    g.surfMin = Math.min(g.surfMin, w.surfMin); g.surfMax = Math.max(g.surfMax, w.surfMax);
  }
  const top = [...groups.values()]
    .sort((a, b) => b.rating - a.rating || b.surfMax - a.surfMax)
    .slice(0, 4)
    .sort((a, b) => (a.date === b.date ? a.from - b.from : (a.date < b.date ? -1 : 1)));
  const spotsTxt = (n) => (n.length <= 3 ? n.join(', ') : `${n.slice(0, 3).join(', ')} y ${n.length - 3} más`);
  const items = top.map((w) => `<li><b>${esc(cap(dayLabel(w.date, dayIndexOf(ref, w.date))))} ${w.from}–${w.to} h:</b> ` +
    `${esc(spotsTxt(w.names))} · ${fmtRange(w.surfMin, w.surfMax)} m · ${esc(ratingWord(w.rating))} · ${esc(w.windLabel.toLowerCase())}</li>`).join('');
  const head = note || 'Mejores ventanas:';
  return `<p>${esc(head)}</p><ul>${items}</ul>`;
}

function answerWetsuit(fc, spot, dayInfo) {
  const f = fc.spots[spot.id];
  if (!f) return p(`Sin datos para ${spot.name}.`);
  const idx = resolveDayIdx(f.days, dayInfo, 0);
  const day = f.days[idx];
  const sst = day?.hours.find((h) => h.sst != null)?.sst ?? null;
  const tempTxt = sst != null ? `Agua a ${Math.round(sst)} °C.` : 'Sin dato de temperatura.';
  return `<p><b>${esc(spot.name)} (${esc(dayLabel(day?.date ?? '', idx))}):</b> ${tempTxt} Traje: ${esc(wetsuitFor(sst))}.</p>`;
}

function answerWind(fc, spot, dayInfo, franja) {
  const f = fc.spots[spot.id];
  if (!f) return p(`Sin datos para ${spot.name}.`);
  const idx = resolveDayIdx(f.days, dayInfo, 0);
  const day = f.days[idx];
  if (!day) return p('Sin previsión para ese día.');
  let hours = franja ? day.hours.filter((h) => h.hour >= franja.from && h.hour <= franja.to) : day.hours;
  if (!hours.length) hours = day.hours;
  const offshore = hours.filter((h) => h.wind.key === 'offshore' || h.wind.key === 'crossoff');
  if (!offshore.length) {
    const dominant = hours[Math.floor(hours.length / 2)].wind;
    return `<p><b>${esc(spot.name)} (${esc(dayLabel(day.date, idx))}):</b> Sin terral; viento dominante ${esc(dominant.label.toLowerCase())}.</p>`;
  }
  const from = offshore[0].hour, to = offshore.at(-1).hour + 1;
  const avgSpeed = Math.round(offshore.reduce((a, h) => a + h.windSpeed, 0) / offshore.length);
  return `<p><b>${esc(spot.name)} (${esc(dayLabel(day.date, idx))}):</b> Terral de ${from} a ${to} h (${avgSpeed} km/h).</p>`;
}

function answerTide(fc, spot, dayInfo) {
  const f = fc.spots[spot.id];
  if (!f) return p(`Sin datos para ${spot.name}.`);
  const idx = resolveDayIdx(f.days, dayInfo, 0);
  const day = f.days[idx];
  if (!day) return p('Sin previsión para ese día.');
  const ex = tideExtremes(day.hours);
  if (!ex.length) return p('Sin datos de marea para ese día.');
  const txt = ex.map((e) => `${e.type === 'high' ? 'Pleamar' : 'Bajamar'} ${e.hour}:00 (${e.tide >= 0 ? '+' : ''}${e.tide.toFixed(2)} m)`).join(', ');
  return `<p><b>${esc(spot.name)} (${esc(dayLabel(day.date, idx))}):</b> ${txt}.</p>`;
}

function answerSpotStatus(fc, spot, dayInfo, franja, wantNow) {
  const f = fc.spots[spot.id];
  if (!f) return p(`Sin datos para ${spot.name}.`);

  if (wantNow && !dayInfo) {
    const h = f.hours[nowIndex(f.hours)];
    const sw = topSwell(h);
    const swTxt = sw ? `${fmtM(sw.h)} m ${sw.t ? Math.round(sw.t) : '–'} s ${compass(sw.dir)}` : 'sin mar de fondo';
    const windTxt = `${esc(h.wind.label.toLowerCase())} ${kmh(h.windSpeed)} ${compass(h.windDir)}`;
    return `<p><b>${esc(spot.name)} ahora (${h.hour}:00):</b> ${fmtRange(h.surf.min, h.surf.max)} m, ${esc(ratingWord(h.rating))}.<br>` +
      `Swell ${swTxt}. Viento ${windTxt}.</p>`;
  }

  const idx = resolveDayIdx(f.days, dayInfo, 0);
  const day = f.days[idx];
  if (!day) return p('Sin previsión para ese día.');
  let hours = franja ? day.hours.filter((h) => h.hour >= franja.from && h.hour <= franja.to) : day.hours;
  if (!hours.length) hours = day.hours;
  const best = hours.reduce((a, b) => (b.rating > a.rating || (b.rating === a.rating && b.surf.mid > a.surf.mid) ? b : a));
  const sw = topSwell(best);
  const swTxt = sw ? `${fmtM(sw.h)} m ${sw.t ? Math.round(sw.t) : '–'} s ${compass(sw.dir)}` : 'sin mar de fondo';
  const windTxt = `${esc(best.wind.label.toLowerCase())} ${kmh(best.windSpeed)} ${compass(best.windDir)}`;
  const franjaTxt = franja ? (franja.exact ? ` a las ${franja.from}:00` : ` de ${hours[0].hour} a ${hours.at(-1).hour} h`) : '';
  const mins = hours.map((h) => h.surf?.min).filter((v) => v != null && !isNaN(v));
  const maxs = hours.map((h) => h.surf?.max).filter((v) => v != null && !isNaN(v));
  return `<p><b>${esc(spot.name)}</b> (${esc(dayLabel(day.date, idx))}${franjaTxt}): ${fmtRange(mins.length ? Math.min(...mins) : null, maxs.length ? Math.max(...maxs) : null)} m, ${esc(ratingWord(best.rating))}.<br>` +
    `Swell ${swTxt}. Viento ${windTxt}.</p>`;
}

// Responde una pregunta libre en español sobre la previsión. Nunca inventa datos: todo sale de fc.
export function answer(question, fc, spots, ctx = {}) {
  const raw = String(question ?? '').trim();
  if (!raw) return suggestionsHtml('Prueba con:');
  if (!fc || !fc.spots) return p('Sin previsión cargada.');

  const q = norm(raw);
  const detected = detectSpots(raw, spots);
  const { franja, day, wantNow } = parseQuery(raw);
  const ctxSpot = ctx?.spotId ? spots.find((s) => s.id === ctx.spotId) : null;

  if (/\bcompara\b/.test(q) && detected.length >= 2) {
    return answerCompare(detected[0], detected[1], fc, day);
  }
  if (/mejor spot|mejor pico|mejor playa|donde surfeo|cual es el mejor|que spot/.test(q)) {
    return answerBestSpot(fc, spots, day);
  }
  if (/cuando surfeo|cuando hay olas|cuando puedo surfear|cuando surfear|proximo dia bueno|proximo buen dia|hay olas/.test(q)) {
    const targetSpots = detected.length ? detected : (ctxSpot ? [ctxSpot] : spots);
    return answerWhen(fc, targetSpots, day);
  }
  if (/traje|neopreno|licra|wetsuit/.test(q)) {
    const spot = detected[0] || ctxSpot || spots[0];
    return spot ? answerWetsuit(fc, spot, day) : suggestionsHtml('Elige un spot:');
  }
  if (/terral|viento|racha/.test(q)) {
    const spot = detected[0] || ctxSpot || spots[0];
    return spot ? answerWind(fc, spot, day, franja) : suggestionsHtml('Elige un spot:');
  }
  if (/marea|pleamar|bajamar/.test(q)) {
    const spot = detected[0] || ctxSpot || spots[0];
    return spot ? answerTide(fc, spot, day) : suggestionsHtml('Elige un spot:');
  }

  const spot = detected[0] || ctxSpot;
  if (spot) return answerSpotStatus(fc, spot, day, franja, wantNow);

  return suggestionsHtml('Prueba con:');
}

// Preguntas sugeridas para el chat, según si el usuario está viendo un spot o la portada
export function suggestions(ctx = {}) {
  if (ctx?.spotId) {
    return [
      '¿Cómo está hoy por la tarde?',
      '¿Cómo está mañana?',
      '¿Hace viento terral mañana?',
      '¿Qué traje llevo?',
      '¿Cuándo surfeo esta semana?',
      'Próximo día bueno'
    ];
  }
  return [
    '¿Cuándo surfeo esta semana?',
    '¿Hay olas el finde?',
    'Mejor spot hoy',
    '¿Qué traje llevo?',
    'Próximo día bueno',
    '¿A qué hora es la marea alta?'
  ];
}
