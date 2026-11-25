export const TZ = 'Europe/Madrid';
export const RANGES = [
  { from: 6, to: 9 },
  { from: 9, to: 12 },
  { from: 12, to: 15 },
  { from: 15, to: 18 },
  { from: 18, to: 20 },
  { from: 7, to: 13 },
  { from: 9, to: 17 }
];
export const SPORTS = ['Surf', 'Longboard', 'Bodyboard', 'SUP', 'Windsurf', 'Kitesurf'];
export const LEVELS = ['Iniciación', 'Intermedio', 'Avanzado', 'Competición'];
export const DEFAULT_RANGE = { from: 9, to: 12 };

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const num = (v) => (v == null || v === '' || isNaN(v) ? null : Number(v));
const round1 = (v) => Math.round(v * 10) / 10;

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

export function dateLongLabel(date) {
  const d = new Date(date + 'T12:00:00');
  if (isNaN(d.getTime())) return String(date || '');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function dateShortLabel(date, today = todayISO()) {
  const d = new Date(date + 'T12:00:00');
  if (isNaN(d.getTime())) return String(date || '');
  const base = `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  if (date === today) return `Hoy · ${base}`;
  const t = new Date(today + 'T12:00:00');
  t.setDate(t.getDate() + 1);
  const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  return date === tomorrow ? `Mañana · ${base}` : base;
}

export function rangeLabel(from, to) {
  return `${String(from).padStart(2, '0')}:00–${String(to).padStart(2, '0')}:00`;
}

export function fmtM(v) {
  const n = num(v);
  return n == null ? '–' : `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;
}

export function fmtRangeM(min, max) {
  const a = num(min);
  const b = num(max);
  if (a == null && b == null) return '–';
  const lo = Math.max(0, round1(a ?? b));
  const hi = round1(b ?? a);
  if (lo === hi) return fmtM(lo);
  return `${lo.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}–${fmtM(hi)}`;
}

export function periodOf(h) {
  const swell = (h?.swells || []).find((s) => num(s?.t) != null);
  return num(swell?.t) ?? num(h?.wavePeriod) ?? num(h?.period);
}

export function hoursInRange(hours, date, from, to) {
  return (hours || [])
    .filter((h) => h && h.date === date && h.hour >= from && h.hour < to)
    .sort((a, b) => a.hour - b.hour);
}

export function forecastDates(fc) {
  const dates = new Set();
  for (const s of Object.values(fc?.spots || {})) {
    for (const d of s.days || []) if (d?.date) dates.add(d.date);
  }
  return [...dates].sort();
}

export function chooseDefaultCompare(spots, favIds = []) {
  const ids = new Set((favIds || []).map((f) => (typeof f === 'string' ? f : f?.id)).filter(Boolean));
  const valid = (spots || []).map((s) => s.id);
  const favs = valid.filter((id) => ids.has(id));
  if (favs.length) return favs.slice(0, 4);
  const priority = ['Planetario', 'Voramar', 'MorroGos', 'Palaciet'];
  const picked = priority.filter((id) => valid.includes(id));
  return (picked.length ? picked : valid).slice(0, 4);
}

export function summarizeSpot(spot, fc, { date, from, to } = {}) {
  const list = hoursInRange(fc?.spots?.[spot?.id]?.hours, date, from, to);
  const withSurf = list.filter((h) => num(h.surf?.mid) != null);
  const surfMins = withSurf.map((h) => num(h.surf?.min) ?? num(h.surf?.mid)).filter((v) => v != null);
  const surfMaxs = withSurf.map((h) => num(h.surf?.max) ?? num(h.surf?.mid)).filter((v) => v != null);
  const periods = withSurf.map(periodOf).filter((v) => v != null);
  const winds = list.map((h) => num(h.windSpeed)).filter((v) => v != null);
  const gusts = list.map((h) => num(h.windGust)).filter((v) => v != null);
  const ratings = list.map((h) => num(h.rating)).filter((v) => v != null);
  const midHour = list[Math.floor((list.length - 1) / 2)] || list[0] || null;
  const best = withSurf.reduce((a, b) => {
    if (!a) return b;
    const ra = num(a.rating) ?? -1;
    const rb = num(b.rating) ?? -1;
    if (rb !== ra) return rb > ra ? b : a;
    return (num(b.surf?.mid) ?? 0) > (num(a.surf?.mid) ?? 0) ? b : a;
  }, null);
  return {
    spotId: spot?.id || null,
    name: spot?.name || '',
    zoneName: spot?.zoneName || '',
    hours: list,
    count: list.length,
    withSurf: withSurf.length,
    missing: list.length - withSurf.length,
    hasData: withSurf.length > 0,
    surfMin: surfMins.length ? Math.min(...surfMins) : null,
    surfMax: surfMaxs.length ? Math.max(...surfMaxs) : null,
    surfAvg: withSurf.length ? withSurf.reduce((a, h) => a + (num(h.surf?.mid) ?? 0), 0) / withSurf.length : null,
    periodMin: periods.length ? Math.min(...periods) : null,
    periodMax: periods.length ? Math.max(...periods) : null,
    windAvg: winds.length ? winds.reduce((a, v) => a + v, 0) / winds.length : null,
    gustMax: gusts.length ? Math.max(...gusts) : null,
    windDir: num(midHour?.windDir),
    windLabel: midHour?.wind?.label || '',
    bestRating: ratings.length ? Math.max(...ratings) : null,
    worstRating: ratings.length ? Math.min(...ratings) : null,
    bestHour: best?.hour ?? null
  };
}

export function parseJornadaParams(search) {
  const p = new URLSearchParams(search || '');
  const out = {};
  const d = p.get('d');
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T12:00:00').getTime())) out.date = d;
  const f = Number(p.get('f'));
  if (Number.isInteger(f) && f >= 6 && f <= 19) out.from = f;
  const t = Number(p.get('t'));
  if (Number.isInteger(t) && t >= 7 && t <= 20) out.to = t;
  const sp = p.get('sp');
  if (SPORTS.includes(sp)) out.sport = sp;
  const n = p.get('n');
  if (LEVELS.includes(n)) out.level = n;
  const s = p.get('s');
  if (s) out.selected = s;
  const c = p.get('c');
  if (c) out.compare = c.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
  return out;
}

export function buildJornadaHash(jr) {
  const p = new URLSearchParams();
  p.set('d', jr.date);
  p.set('f', String(jr.from));
  p.set('t', String(jr.to));
  p.set('sp', jr.sport);
  p.set('n', jr.level);
  p.set('s', jr.selected || '');
  p.set('c', (jr.compare || []).join(','));
  return `#/jornada?${p.toString()}`;
}

export function validateJornadaState(input = {}, { dates = [], spotIds = [], defaultCompare = [] } = {}) {
  const src = input || {};
  const valid = new Set(spotIds);
  const fallbackDate = dates[0] || todayISO();
  const date = dates.includes(src.date) ? src.date : fallbackDate;
  let from = Number.isInteger(src.from) ? src.from : DEFAULT_RANGE.from;
  let to = Number.isInteger(src.to) ? src.to : DEFAULT_RANGE.to;
  if (from < 6 || from > 19) from = DEFAULT_RANGE.from;
  if (to < 7 || to > 20) to = DEFAULT_RANGE.to;
  if (from >= to) { from = DEFAULT_RANGE.from; to = DEFAULT_RANGE.to; }
  if (to - from > 12) to = Math.min(24, from + 12);
  const sport = SPORTS.includes(src.sport) ? src.sport : 'Surf';
  const level = LEVELS.includes(src.level) ? src.level : 'Intermedio';
  let compare = Array.isArray(src.compare) ? src.compare.filter((id) => valid.has(id)) : [];
  compare = [...new Set(compare)].slice(0, 8);
  if (!compare.length) compare = (defaultCompare || []).filter((id) => valid.has(id)).slice(0, 8);
  if (!compare.length && spotIds.length) compare = spotIds.slice(0, 4);
  let selected = valid.has(src.selected) ? src.selected : compare[0];
  if (!selected) selected = spotIds[0] || null;
  if (selected && !compare.includes(selected)) compare = [selected, ...compare].slice(0, 8);
  return { date, from, to, sport, level, compare, selected };
}

export function buildShareText({ date, from, to, sport, level, rows = [], updatedAt, observation, url }) {
  const lines = [
    'MeteoSurf · Parte de jornada',
    `Fecha: ${dateLongLabel(date)}`,
    `Franja: ${rangeLabel(from, to)} (${to - from} h) · Europe/Madrid (hora peninsular)`,
    `Deporte: ${sport} · Nivel del grupo: ${level}`,
    '',
    'Lugares:'
  ];
  for (const r of rows) {
    if (!r.hasData) {
      lines.push(`- ${r.name}: sin datos de oleaje para esta franja.`);
      continue;
    }
    const period = r.periodMin != null
      ? `${Math.round(r.periodMin)}${r.periodMax != null && Math.round(r.periodMax) !== Math.round(r.periodMin) ? `–${Math.round(r.periodMax)}` : ''} s`
      : 'sin dato';
    const wind = r.windAvg != null
      ? `${Math.round(r.windAvg)} km/h${r.windText ? ` ${r.windText}` : ''}`
      : 'sin dato';
    const gust = r.gustMax != null ? `${Math.round(r.gustMax)} km/h` : 'sin dato';
    const quality = r.ratingLabel || 'sin valoración';
    lines.push(`- ${r.name}: ola en playa ${fmtRangeM(r.surfMin, r.surfMax)} · periodo ${period} · viento ${wind} · rachas ${gust} · calidad ${quality}.`);
  }
  lines.push('');
  lines.push(`Fuente: Open-Meteo (modelo marino y viento)${updatedAt ? ` · actualizado ${updatedAt}` : ''}.`);
  if (observation) lines.push(`Observación ahora: ${observation}`);
  lines.push('Nota: la ola en playa es una estimación de rompiente; Hs es altura significante mar adentro y la boya es una medición. El nivel es contexto del grupo, no un veredicto de seguridad.');
  if (url) lines.push('', `Enlace: ${url}`);
  return lines.join('\n');
}

const SVG = {
  share: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
  star: (on) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"${on ? ' style="fill:currentColor"' : ''}><path d="M6 3h12v18l-6-4-6 4z"/></svg>`,
  x: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  cam: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l5-3v10l-5-3M3 7h12v10H3z"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  arrow: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  wave: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 17c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/></svg>',
  wind: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg>',
  calendar: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  info: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};

export function createJornadaView(api) {
  const {
    root, state, store, spots, favs, toggleFav, esc, ratingCls, ratingLabel, compass,
    camsForSpot, playCam, stopCam, clipsForSpot, toast, realNumber, realValue,
    realDirection, realSource, realStatus, initAemetMapWidget, footer
  } = api;

  let jr = null;
  let camSpot = null;

  const spotById = (id) => spots.find((s) => s.id === id);
  const ids = () => spots.map((s) => s.id);
  const dates = () => forecastDates(state.fc);

  function defaults() {
    const compare = chooseDefaultCompare(spots, [...favs]);
    return { ...DEFAULT_RANGE, date: todayISO(), sport: 'Surf', level: 'Intermedio', compare, selected: compare[0] || null };
  }

  function normalize(input) {
    return validateJornadaState(input, {
      dates: dates(),
      spotIds: ids(),
      defaultCompare: chooseDefaultCompare(spots, [...favs])
    });
  }

  function save() {
    if (!jr) return;
    store.set('jornada', {
      date: jr.date, from: jr.from, to: jr.to, sport: jr.sport,
      level: jr.level, compare: [...jr.compare], selected: jr.selected
    });
  }

  function syncHash() {
    if (!jr || !location.hash.startsWith('#/jornada')) return;
    const hash = buildJornadaHash(jr);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function applyQuery() {
    const q = location.hash.split('?')[1] || '';
    const parsed = parseJornadaParams(q);
    if (!Object.keys(parsed).length) return;
    jr = normalize({ ...jr, ...parsed });
  }

  function render() {
    jr = normalize(state.jornada || store.get('jornada', null) || defaults());
    state.jornada = jr;
    applyQuery();
    if (!state.fc) {
      root.innerHTML = `<div class="jr-loading"><div class="skeleton" style="height:28px;width:220px"></div><div class="skeleton" style="height:72px;margin-top:16px"></div><div class="skeleton" style="height:320px;margin-top:16px"></div></div>`;
      return;
    }
    root.innerHTML = shell();
    bind();
    update({ first: true });
    syncHash();
    save();
    initAemetMapWidget();
  }

  function shell() {
    const fc = state.fc;
    const today = todayISO();
    const dateOptions = dates().map((d) => `<option value="${d}"${d === jr.date ? ' selected' : ''}>${esc(dateShortLabel(d, today))}</option>`).join('');
    const allRanges = RANGES.some((r) => r.from === jr.from && r.to === jr.to) ? RANGES : [...RANGES, { from: jr.from, to: jr.to }].sort((a, b) => a.from - b.from);
    const rangeOptions = allRanges.map((r) => `<option value="${r.from}-${r.to}"${r.from === jr.from && r.to === jr.to ? ' selected' : ''}>${rangeLabel(r.from, r.to)} · ${r.to - r.from} h</option>`).join('');
    const sportOptions = SPORTS.map((s) => `<option${s === jr.sport ? ' selected' : ''}>${s}</option>`).join('');
    const levelOptions = LEVELS.map((n) => `<option${n === jr.level ? ' selected' : ''}>${n}</option>`).join('');
    const updated = new Date(fc.fetchedAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      ${fc.stale ? `<div class="banner" role="status">Sin conexión con el servicio de previsión. Mostrando la última previsión guardada (${esc(new Date(fc.fetchedAt).toLocaleString('es-ES'))}).</div>` : ''}
      <header class="jr-head">
        <div class="jr-head-main">
          <h1>Planificar jornada</h1>
          <p class="jr-sub">Costa de Castellón · <span class="num">${esc(updated)}</span> · previsión por horas</p>
        </div>
        <div class="jr-head-actions">
          <a class="jr-quiet-link" href="#/ahora">Ver recomendación de ahora ${SVG.arrow}</a>
          <button type="button" class="jr-btn jr-btn-primary" id="jr-share">${SVG.share}<span>Compartir parte</span></button>
        </div>
      </header>
      <section class="jr-filters" aria-label="Filtros de la jornada">
        <label class="jr-field"><span>Fecha</span><select id="jr-date">${dateOptions}</select></label>
        <label class="jr-field"><span>Franja</span><select id="jr-range">${rangeOptions}</select></label>
        <label class="jr-field"><span>Deporte</span><select id="jr-sport">${sportOptions}</select></label>
        <label class="jr-field"><span>Nivel del grupo</span><select id="jr-level">${levelOptions}</select></label>
      </section>
      <p class="jr-hint">${SVG.info}<span>El nivel es contexto del grupo, no un filtro automático de seguridad. La previsión es un modelo, no una medición.</span></p>
      <div class="jr-layout">
        <div class="jr-main">
          <section class="jr-panel jr-compare" aria-labelledby="jr-compare-title">
            <div class="jr-panel-head">
              <div>
                <h2 id="jr-compare-title">Comparar lugares</h2>
                <p>Misma fecha y franja para todos. Elige un lugar para inspeccionarlo.</p>
              </div>
              <div class="jr-compare-actions">
                <select id="jr-add-spot" aria-label="Añadir lugar a la comparación"></select>
                <button type="button" class="jr-btn jr-btn-secondary" id="jr-add-btn">Añadir</button>
                <button type="button" class="jr-btn jr-btn-quiet" id="jr-favs-btn">Mis spots</button>
              </div>
            </div>
            <div class="jr-compare-head" aria-hidden="true">
              <span>Lugar</span><span>Ola en playa</span><span>Periodo</span><span>Viento</span><span>Rachas</span><span>Calidad</span><span></span>
            </div>
            <div id="jr-compare-body" role="radiogroup" aria-label="Lugares comparados"></div>
            <p class="jr-compare-note">Ola en playa = estimación de rompiente. Hs = altura significante mar adentro. La boya mide otra cosa y se muestra aparte.</p>
          </section>
          <section class="jr-panel jr-chart-panel" aria-labelledby="jr-chart-title">
            <div class="jr-panel-head">
              <div>
                <h2 id="jr-chart-title">Evolución de la franja</h2>
                <p id="jr-chart-sub">Modelo por horas</p>
              </div>
              <div class="jr-legend" id="jr-legend"></div>
            </div>
            <div class="jr-chart-scroll" id="jr-chart"></div>
            <p class="jr-chart-note">La línea y la banda son ola en playa estimada. La discontinua es Hs mar adentro. No se mezclan con la medición de la boya.</p>
            <div id="jr-hours"></div>
          </section>
        </div>
        <aside class="jr-panel jr-inspector" id="jr-inspector" aria-labelledby="jr-inspector-title">
          <div id="jr-inspector-head"></div>
          <div class="cam jr-cam" id="jr-cam"></div>
          <div class="jr-cam-info" id="jr-cam-info"></div>
          <div id="jr-inspector-info"></div>
        </aside>
      </div>
      <section class="jr-aemet" aria-labelledby="jr-aemet-title">
        <div class="jr-section-head">
          <div><h2 id="jr-aemet-title">Mapa AEMET</h2><p>Predicción marítima · Mar combinada · Levante</p></div>
          <a href="https://www.aemet.es/es/eltiempo/prediccion/maritima?opc1=0&opc3=0&area=val1" target="_blank" rel="noopener">Ver en aemet.es ${SVG.arrow}</a>
        </div>
        <div class="jr-aemet-card">
          <div class="jr-aemet-media">
            <img id="aemet-map-img" src="" alt="Cargando mapa AEMET…" loading="lazy">
            <div id="aemet-map-skeleton" class="skeleton"></div>
            <p id="aemet-map-error">Mapa AEMET no disponible en este momento.<br><a href="https://www.aemet.es/es/eltiempo/prediccion/maritima?opc1=0&opc3=0&area=val1" target="_blank" rel="noopener">Ver en aemet.es →</a></p>
          </div>
          <div class="jr-aemet-controls">
            <div class="jr-aemet-status"><span id="aemet-map-time"></span><span id="aemet-map-frame"></span></div>
            <div id="aemet-timeline"></div>
            <div class="jr-aemet-buttons">
              <button class="jr-btn jr-btn-quiet" id="aemet-first" aria-label="Primer fotograma" title="Inicio">⏮</button>
              <button class="jr-btn jr-btn-quiet" id="aemet-prev" aria-label="Anterior" title="Anterior">⏪</button>
              <button class="jr-btn jr-btn-primary" id="aemet-play" aria-label="Reproducir" title="Reproducir">▶</button>
              <button class="jr-btn jr-btn-quiet" id="aemet-next" aria-label="Siguiente" title="Siguiente">⏩</button>
              <button class="jr-btn jr-btn-quiet" id="aemet-last" aria-label="Último fotograma" title="Final">⏭</button>
            </div>
            <p class="jr-source">Modelo WAM · AEMET · Levante</p>
          </div>
        </div>
      </section>
      ${footer()}
    `;
  }

  function bind() {
    root.querySelector('#jr-date')?.addEventListener('change', (e) => { jr.date = e.target.value; update(); });
    root.querySelector('#jr-range')?.addEventListener('change', (e) => {
      const [from, to] = e.target.value.split('-').map(Number);
      jr.from = from; jr.to = to; update();
    });
    root.querySelector('#jr-sport')?.addEventListener('change', (e) => { jr.sport = e.target.value; update(); });
    root.querySelector('#jr-level')?.addEventListener('change', (e) => { jr.level = e.target.value; update(); });
    root.querySelector('#jr-share')?.addEventListener('click', share);
    root.querySelector('#jr-add-btn')?.addEventListener('click', () => {
      addSpot(root.querySelector('#jr-add-spot')?.value);
    });
    root.querySelector('#jr-favs-btn')?.addEventListener('click', () => {
      const compare = chooseDefaultCompare(spots, [...favs]);
      if (!compare.length) return;
      jr.compare = compare;
      jr.selected = compare[0];
      update();
    });
    root.querySelector('#jr-compare-body')?.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="jr-spot"]');
      if (!input) return;
      jr.selected = input.value;
      update();
    });
    if (!root.dataset.jrDelegated) {
      root.dataset.jrDelegated = '1';
      root.addEventListener('click', (e) => {
        const favBtn = e.target.closest('[data-jr-fav]');
        if (favBtn) {
          toggleFav(favBtn.dataset.jrFav);
          update();
          return;
        }
        const rmBtn = e.target.closest('[data-jr-remove]');
        if (rmBtn) {
          removeSpot(rmBtn.dataset.jrRemove);
          return;
        }
        if (e.target.closest('[data-jr-playcam]')) mountCam(true);
      });
    }
  }

  function update({ first = false } = {}) {
    if (!state.fc || !jr) return;
    const spot = spotById(jr.selected) || spots[0];
    if (!spot) return;
    jr.selected = spot.id;
    if (!jr.compare.includes(spot.id)) jr.compare = [spot.id, ...jr.compare].slice(0, 8);
    renderCompare();
    renderAddOptions();
    renderChart(spot);
    renderHours(spot);
    renderInspectorHead(spot);
    renderInspectorInfo(spot);
    mountCam(first || camSpot !== spot.id);
    camSpot = spot.id;
    syncHash();
    save();
  }

  function addSpot(id) {
    if (!id || !spotById(id) || jr.compare.includes(id)) return;
    if (jr.compare.length >= 8) { toast('Puedes comparar hasta 8 lugares.'); return; }
    jr.compare.push(id);
    jr.selected = id;
    update();
  }

  function removeSpot(id) {
    if (jr.compare.length <= 1) return;
    jr.compare = jr.compare.filter((x) => x !== id);
    if (jr.selected === id) jr.selected = jr.compare[0];
    update();
  }

  function renderAddOptions() {
    const sel = root.querySelector('#jr-add-spot');
    if (!sel) return;
    const available = spots.filter((s) => !jr.compare.includes(s.id));
    sel.disabled = available.length === 0;
    sel.innerHTML = available.length
      ? `<option value="">Añadir lugar…</option>${available.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.zoneName)}</option>`).join('')}`
      : '<option value="">Todos los lugares están en la comparación</option>';
  }

  function renderCompare() {
    const body = root.querySelector('#jr-compare-body');
    if (!body) return;
    body.innerHTML = jr.compare.map((id) => {
      const spot = spotById(id);
      if (!spot) return '';
      const sum = summarizeSpot(spot, state.fc, jr);
      const selected = spot.id === jr.selected;
      const rating = sum.hasData ? sum.bestRating : null;
      const period = sum.periodMin != null
        ? `${Math.round(sum.periodMin)}${sum.periodMax != null && Math.round(sum.periodMax) !== Math.round(sum.periodMin) ? `–${Math.round(sum.periodMax)}` : ''} s`
        : 'Sin dato';
      const wind = sum.windAvg != null ? `${Math.round(sum.windAvg)} km/h ${compass(sum.windDir)}` : 'Sin dato';
      const gust = sum.gustMax != null ? `${Math.round(sum.gustMax)} km/h` : 'Sin dato';
      return `<div class="jr-row${selected ? ' is-selected' : ''}" data-jr-row="${esc(spot.id)}">
        <label class="jr-row-pick">
          <input type="radio" name="jr-spot" value="${esc(spot.id)}"${selected ? ' checked' : ''} aria-label="Inspeccionar ${esc(spot.name)}">
          <span class="jr-row-name"><b>${esc(spot.name)}</b><small>${esc(spot.zoneName)}</small></span>
        </label>
        <div class="jr-cell"><span class="jr-cell-label">Ola en playa</span><b class="num">${sum.hasData ? fmtRangeM(sum.surfMin, sum.surfMax) : 'Sin dato'}</b><small>estimación</small></div>
        <div class="jr-cell"><span class="jr-cell-label">Periodo</span><b class="num">${period}</b></div>
        <div class="jr-cell"><span class="jr-cell-label">Viento</span><b class="num">${wind}</b>${sum.windLabel ? `<small>${esc(sum.windLabel)}</small>` : ''}</div>
        <div class="jr-cell"><span class="jr-cell-label">Rachas</span><b class="num">${gust}</b></div>
        <div class="jr-cell"><span class="jr-cell-label">Calidad</span>${sum.hasData ? `<span class="rating-pill ${ratingCls(rating)}">${esc(ratingLabel(rating))}</span>` : '<span class="jr-muted">Sin datos</span>'}</div>
        <div class="jr-row-actions">
          <button type="button" class="jr-icon-btn${favs.has(spot.id) ? ' is-on' : ''}" data-jr-fav="${esc(spot.id)}" aria-label="${favs.has(spot.id) ? 'Quitar de mis spots' : 'Añadir a mis spots'}" title="Mis spots">${SVG.star(favs.has(spot.id))}</button>
          ${jr.compare.length > 1 ? `<button type="button" class="jr-icon-btn" data-jr-remove="${esc(spot.id)}" aria-label="Quitar ${esc(spot.name)} de la comparación" title="Quitar">${SVG.x}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function chartSeries(spot) {
    const hours = state.fc?.spots?.[spot.id]?.hours || [];
    const byHour = new Map(hours.filter((h) => h.date === jr.date).map((h) => [h.hour, h]));
    return Array.from({ length: 15 }, (_, i) => {
      const hour = 6 + i;
      const h = byHour.get(hour) || null;
      return {
        hour,
        surfMin: num(h?.surf?.min),
        surfMax: num(h?.surf?.max),
        surfMid: num(h?.surf?.mid),
        offshore: num(h?.waveHeight)
      };
    });
  }

  function renderChart(spot) {
    const chart = root.querySelector('#jr-chart');
    const title = root.querySelector('#jr-chart-title');
    const sub = root.querySelector('#jr-chart-sub');
    const legend = root.querySelector('#jr-legend');
    if (!chart) return;
    if (title) title.textContent = `${spot.name} · ${spot.zoneName}`;
    if (sub) sub.textContent = `${dateLongLabel(jr.date)} · ${rangeLabel(jr.from, jr.to)} · modelo por horas`;
    if (legend) legend.innerHTML = `<span><i class="jr-swatch jr-swatch-line"></i>Ola en playa</span><span><i class="jr-swatch jr-swatch-band"></i>Rango</span><span><i class="jr-swatch jr-swatch-dash"></i>Hs mar adentro</span>`;
    const series = chartSeries(spot);
    const values = series.flatMap((p) => [p.surfMax, p.offshore]).filter((v) => v != null);
    if (!values.length) {
      chart.innerHTML = `<div class="jr-empty">Sin datos de oleaje para ${esc(dateLongLabel(jr.date))}. Prueba otra fecha o franja.</div>`;
      return;
    }
    const compact = root.clientWidth > 0 && root.clientWidth < 600;
    const W = compact ? 360 : 720;
    const H = compact ? 220 : 240;
    const padL = compact ? 34 : 42;
    const padR = compact ? 10 : 14;
    const padT = compact ? 16 : 18;
    const padB = compact ? 28 : 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yMax = Math.max(0.5, Math.ceil(Math.max(...values) * 2) / 2);
    const x = (hour) => padL + ((hour - 6) / 14) * plotW;
    const y = (v) => padT + plotH - (v / yMax) * plotH;
    const segments = (key) => {
      const out = [];
      let cur = [];
      for (const p of series) {
        if (p[key] != null) cur.push(p);
        else if (cur.length) { out.push(cur); cur = []; }
      }
      if (cur.length) out.push(cur);
      return out;
    };
    const linePath = (seg, key) => seg.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
    const bandPath = (seg) => {
      const top = seg.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(1)} ${y(p.surfMax).toFixed(1)}`).join(' ');
      const bottom = [...seg].reverse().map((p) => `L ${x(p.hour).toFixed(1)} ${y(p.surfMin).toFixed(1)}`).join(' ');
      return `${top} ${bottom} Z`;
    };
    const gridStep = yMax <= 0.5 ? 0.1 : yMax <= 1.5 ? 0.5 : 1;
    const grid = [];
    for (let v = 0; v <= yMax + 0.001; v += gridStep) {
      grid.push(`<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" class="jr-grid-line"/>`);
      grid.push(`<text x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="jr-axis-text">${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</text>`);
    }
    const xTicks = [6, 9, 12, 15, 18, 20];
    const xAxis = xTicks.map((h) => `<text x="${x(h).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="jr-axis-text">${String(h).padStart(2, '0')}</text>`).join('');
    const rf = Math.max(6, jr.from);
    const rt = Math.min(20, jr.to);
    const rangeRect = rt > rf
      ? `<rect x="${x(rf).toFixed(1)}" y="${padT}" width="${(x(rt) - x(rf)).toFixed(1)}" height="${plotH}" class="jr-chart-range"/><text x="${(x(rf) + 4).toFixed(1)}" y="${padT + 12}" class="jr-range-text">${String(rf).padStart(2, '0')}:00</text><text x="${(x(rt) - 4).toFixed(1)}" y="${padT + 12}" text-anchor="end" class="jr-range-text">${String(rt).padStart(2, '0')}:00</text>`
      : '';
    const band = segments('surfMin').filter((seg) => seg.every((p) => p.surfMax != null)).map((seg) => `<path d="${bandPath(seg)}" class="jr-band"/>`).join('');
    const mid = segments('surfMid').map((seg) => `<path d="${linePath(seg, 'surfMid')}" class="jr-line"/>`).join('');
    const dots = series.filter((p) => p.surfMid != null).map((p) => `<circle cx="${x(p.hour).toFixed(1)}" cy="${y(p.surfMid).toFixed(1)}" r="2.6" class="jr-dot"/>`).join('');
    const offshore = segments('offshore').map((seg) => `<path d="${linePath(seg, 'offshore')}" class="jr-dash"/>`).join('');
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ola en playa estimada y Hs mar adentro en ${esc(spot.name)}, ${esc(dateLongLabel(jr.date))}, de ${rangeLabel(jr.from, jr.to)}">
      <title>Ola en playa y Hs mar adentro en ${esc(spot.name)}</title>
      <desc>Modelo por horas entre las ${String(jr.from).padStart(2, '0')}:00 y las ${String(jr.to).padStart(2, '0')}:00. La banda muestra el rango de ola en playa estimada y la línea discontinua la altura significante mar adentro.</desc>
      ${rangeRect}${grid.join('')}${xAxis}
      <text x="${padL - 8}" y="${padT - 6}" text-anchor="end" class="jr-axis-text">m</text>
      ${band}${mid}${dots}${offshore}
    </svg>`;
  }

  function renderHours(spot) {
    const box = root.querySelector('#jr-hours');
    if (!box) return;
    const list = hoursInRange(state.fc?.spots?.[spot.id]?.hours, jr.date, jr.from, jr.to);
    if (!list.length) {
      box.innerHTML = `<div class="jr-empty">No hay horas de previsión dentro de esta franja. Prueba otra franja.</div>`;
      return;
    }
    const rows = list.map((h) => {
      const surf = h.surf?.mid != null ? fmtRangeM(h.surf.min, h.surf.max) : 'Sin dato';
      const period = periodOf(h);
      const wind = h.windSpeed != null ? `${Math.round(h.windSpeed)} km/h ${compass(h.windDir)}` : 'Sin dato';
      const gust = h.windGust != null ? `${Math.round(h.windGust)} km/h` : 'Sin dato';
      const rating = h.rating != null ? `<span class="rating-pill ${ratingCls(h.rating)}">${esc(ratingLabel(h.rating))}</span>` : '<span class="jr-muted">Sin datos</span>';
      return `<tr${h.surf?.mid == null ? ' class="is-missing"' : ''}>
        <th scope="row" class="num">${String(h.hour).padStart(2, '0')}:00</th>
        <td class="num">${surf}</td>
        <td class="num">${period != null ? `${Math.round(period)} s` : 'Sin dato'}</td>
        <td>${wind}${h.wind?.label ? `<small>${esc(h.wind.label)}</small>` : ''}</td>
        <td class="num">${gust}</td>
        <td>${rating}</td>
      </tr>`;
    }).join('');
    box.innerHTML = `<div class="jr-hours-head"><h3>Detalle de la franja</h3><p>Horas incluidas: desde las ${String(jr.from).padStart(2, '0')}:00 hasta antes de las ${String(jr.to).padStart(2, '0')}:00. No se extrapolan datos.</p></div>
      <div class="jr-table-wrap" tabindex="0" role="region" aria-label="Tabla horaria de la franja, desplazable horizontalmente"><table class="jr-table">
        <caption class="jr-sr-only">Previsión por horas dentro de la franja seleccionada</caption>
        <thead><tr><th scope="col">Hora</th><th scope="col">Ola playa</th><th scope="col">Periodo</th><th scope="col">Viento</th><th scope="col">Rachas</th><th scope="col">Calidad</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  function renderInspectorHead(spot) {
    const box = root.querySelector('#jr-inspector-head');
    if (!box) return;
    box.innerHTML = `<div class="jr-inspector-title">
      <div>
        <span class="jr-kicker">${esc(spot.zoneName)}</span>
        <h2 id="jr-inspector-title">${esc(spot.name)}</h2>
        <p>${esc(spot.bottom || '')}${spot.bestTide ? ` · ${esc(spot.bestTide)}` : ''}</p>
      </div>
      <button type="button" class="jr-icon-btn${favs.has(spot.id) ? ' is-on' : ''}" data-jr-fav="${esc(spot.id)}" aria-label="${favs.has(spot.id) ? 'Quitar de mis spots' : 'Añadir a mis spots'}" title="Mis spots">${SVG.star(favs.has(spot.id))}</button>
    </div>`;
  }

  function renderInspectorInfo(spot) {
    const box = root.querySelector('#jr-inspector-info');
    const camInfo = root.querySelector('#jr-cam-info');
    if (!box) return;
    const sum = summarizeSpot(spot, state.fc, jr);
    const rating = sum.hasData ? sum.bestRating : null;
    const period = sum.periodMin != null
      ? `${Math.round(sum.periodMin)}${sum.periodMax != null && Math.round(sum.periodMax) !== Math.round(sum.periodMin) ? `–${Math.round(sum.periodMax)}` : ''} s`
      : 'Sin dato';
    const wind = sum.windAvg != null ? `${Math.round(sum.windAvg)} km/h ${compass(sum.windDir)}` : 'Sin dato';
    const gust = sum.gustMax != null ? `${Math.round(sum.gustMax)} km/h` : 'Sin dato';
    const best = sum.bestHour != null ? `${String(sum.bestHour).padStart(2, '0')}:00` : 'sin hora válida';
    const cam = camsForSpot(spot)[0];
    const clips = clipsForSpot(spot);
    const wave = state.realtime?.oleaje?.principal;
    const status = realStatus(wave);
    const validWave = realNumber(wave?.altura_m, 0, 20);
    const obsDateNote = jr.date !== todayISO()
      ? `<p class="jr-note">La observación es de ahora. La previsión seleccionada es para ${esc(dateLongLabel(jr.date))}.</p>`
      : '';
    const observation = validWave
      ? `<div class="jr-obs${status.stale ? ' is-stale' : ''}">
          <div class="jr-obs-head"><span>${status.stale ? 'Observación antigua' : 'Observación ahora'}</span><span>${esc(status.label)}</span></div>
          <div class="jr-obs-values">
            <div><span>Hs boya</span><b class="num">${realValue(wave.altura_m, 'm', 1, 0, 20)}</b></div>
            <div><span>Periodo</span><b class="num">${realValue(wave.periodo_s, 's', 1, 0, 30)}</b></div>
            <div><span>Dirección</span><b>${realDirection(wave)}</b></div>
          </div>
          <p class="jr-source">${realSource(wave, spot)} · <a href="https://portus.puertos.es/" target="_blank" rel="noopener">Puertos del Estado</a></p>
          <p class="jr-note">Es una medición de boya cercana, no la previsión de esta franja.</p>
        </div>`
      : `<div class="jr-empty jr-empty-compact">Sin observación de boya válida ahora.</div>`;
    if (camInfo) {
      camInfo.innerHTML = cam
        ? `<p class="jr-cam-credit">${SVG.cam}<span>${esc(cam.name)}${cam.distanceKm != null ? ` · ${esc(String(cam.distanceKm))} km` : ''}${cam.credit ? ` · ${esc(cam.credit)}` : ''}</span></p>`
        : `<p class="jr-cam-credit jr-muted">${SVG.cam}<span>Sin cámara pública para este spot.</span></p>`;
    }
    box.innerHTML = `
      ${sum.hasData ? `<div class="jr-inspector-section">
        <h3>Resumen de la franja</h3>
        <div class="jr-kpis">
          <div><span>Ola en playa</span><b class="num">${fmtRangeM(sum.surfMin, sum.surfMax)}</b><small>estimación</small></div>
          <div><span>Periodo</span><b class="num">${period}</b></div>
          <div><span>Viento</span><b class="num">${wind}</b>${sum.windLabel ? `<small>${esc(sum.windLabel)}</small>` : ''}</div>
          <div><span>Rachas</span><b class="num">${gust}</b></div>
        </div>
        <div class="jr-quality"><span class="rating-pill ${ratingCls(rating)}">${esc(ratingLabel(rating))}</span><span>Mejor hora: ${best}</span></div>
      </div>` : `<div class="jr-inspector-section"><div class="jr-empty jr-empty-compact">Sin datos de oleaje para esta franja. Cambia la fecha o la franja.</div></div>`}
      <div class="jr-inspector-section">
        <h3>Observación ahora</h3>
        ${observation}
        ${obsDateNote}
      </div>
      <div class="jr-inspector-section">
        <h3>Fuente de la previsión</h3>
        <p class="jr-source">Open-Meteo · modelo marino y viento · actualizado ${esc(new Date(state.fc.fetchedAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}.${state.fc.stale ? ' Datos guardados sin conexión.' : ''}</p>
        <p class="jr-note">Hs es altura significante mar adentro. La ola en playa se estima con la física de rompiente del spot.</p>
      </div>
      <div class="jr-context-box">
        <div><span>Deporte</span><b>${esc(jr.sport)}</b></div>
        <div><span>Nivel del grupo</span><b>${esc(jr.level)}</b></div>
        <p>El nivel es contexto para el parte, no un veredicto de seguridad.</p>
      </div>
      <div class="jr-inspector-links">
        <a class="jr-btn jr-btn-secondary" href="#/spot/${encodeURIComponent(spot.id)}">Ficha y Rewind ${SVG.arrow}</a>
        ${clips.length ? `<span class="jr-muted">${clips.length} grabación${clips.length === 1 ? '' : 'es'} disponible${clips.length === 1 ? '' : 's'}</span>` : ''}
      </div>`;
  }

  function mountCam(force = false) {
    const el = root.querySelector('#jr-cam');
    if (!el) return;
    const spot = spotById(jr.selected);
    if (!spot) return;
    const cam = camsForSpot(spot)[0];
    if (!cam) {
      if (camSpot !== spot.id || force) {
        stopCam(el);
        el.dataset.jrCam = spot.id;
        el.innerHTML = `<div class="jr-cam-empty">${SVG.cam}<span>Sin cámara pública para ${esc(spot.name)}.</span></div>`;
      }
      return;
    }
    if (force) {
      el.dataset.jrCam = spot.id;
      playCam(el, cam, { autoplay: true });
      return;
    }
    if (camSpot === spot.id && el.dataset.jrCam === spot.id) return;
    const desktop = window.matchMedia('(min-width: 1000px)').matches;
    if (desktop) {
      el.dataset.jrCam = spot.id;
      playCam(el, cam, { autoplay: true });
      return;
    }
    stopCam(el);
    el.dataset.jrCam = spot.id;
    el.innerHTML = `<div class="jr-cam-poster">
      <div class="jr-cam-poster-icon">${SVG.cam}</div>
      <b>${esc(spot.name)} en directo</b>
      <span>${esc(cam.name)}</span>
      <button type="button" class="jr-btn jr-btn-primary" data-jr-playcam>${SVG.play}<span>Ver cámara en directo</span></button>
      <small>La reproducción se activa al pulsar.</small>
    </div>`;
  }

  function share() {
    const spot = spotById(jr.selected);
    if (!spot) return;
    const rows = jr.compare.map((id) => {
      const s = spotById(id);
      if (!s) return null;
      const sum = summarizeSpot(s, state.fc, jr);
      const r = sum.hasData ? sum.bestRating : null;
      return {
        ...sum,
        windText: sum.windAvg != null ? `${compass(sum.windDir)}${sum.windLabel ? ` · ${sum.windLabel}` : ''}` : '',
        ratingLabel: sum.hasData ? ratingLabel(r) : 'Sin datos'
      };
    }).filter(Boolean);
    const wave = state.realtime?.oleaje?.principal;
    const status = realStatus(wave);
    const validWave = realNumber(wave?.altura_m, 0, 20);
    const observation = validWave
      ? `${wave.estacion || 'Boya de Puertos del Estado'}, Hs ${realValue(wave.altura_m, 'm', 1, 0, 20)}, periodo ${realValue(wave.periodo_s, 's', 1, 0, 30)}, ${realDirection(wave)}; ${status.label} (medición ahora, no previsión).`
      : '';
    const updatedAt = new Date(state.fc.fetchedAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const url = `${location.href.split('#')[0]}${buildJornadaHash(jr)}`;
    const text = buildShareText({
      date: jr.date, from: jr.from, to: jr.to, sport: jr.sport, level: jr.level,
      rows, updatedAt, observation, url
    });
    const fallback = () => showShareFallback(text);
    if (navigator.share) {
      navigator.share({ title: 'MeteoSurf · Parte de jornada', text }).catch((err) => {
        if (err?.name === 'AbortError') {
          toast('Compartir cancelado.');
          return;
        }
        fallback();
      });
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Parte copiado al portapapeles.'), fallback);
      return;
    }
    fallback();
  }

  function showShareFallback(text) {
    let dialog = document.getElementById('jr-share-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'jr-share-dialog';
      dialog.className = 'jr-share-dialog';
      dialog.innerHTML = `<form method="dialog" class="jr-share-card">
        <div class="jr-share-head"><h2>Compartir parte</h2><button class="jr-icon-btn" value="close" aria-label="Cerrar">${SVG.x}</button></div>
        <p>Selecciona y copia el texto. Incluye fecha, franja, fuentes y enlace.</p>
        <textarea id="jr-share-text" readonly aria-label="Texto del parte"></textarea>
        <div class="jr-share-actions"><button type="button" class="jr-btn jr-btn-primary" id="jr-share-copy">Copiar texto</button><button class="jr-btn jr-btn-secondary" value="close">Cerrar</button></div>
      </form>`;
      document.body.appendChild(dialog);
      dialog.querySelector('#jr-share-copy')?.addEventListener('click', async () => {
        const area = dialog.querySelector('#jr-share-text');
        area?.select();
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(area.value);
          else document.execCommand('copy');
          toast('Parte copiado al portapapeles.');
        } catch {
          toast('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
        }
      });
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    }
    const area = dialog.querySelector('#jr-share-text');
    if (area) area.value = text;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(() => area?.select(), 30);
  }

  return { render };
}
