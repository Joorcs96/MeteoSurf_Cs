// votar.js — Formulario para reportar una sesión (votar.html).
import { SPOTS } from './spots.js';

const STORAGE_KEY = 'msc_sessions';
const REPO_ISSUES_URL = 'https://github.com/Joorcs96/MeteoSurf_Cs/issues/new';

const spotSelect = document.getElementById('f-spot');
const datetimeInput = document.getElementById('f-datetime');
const form = document.getElementById('report-form');
const historyEl = document.getElementById('history');
const clearAllBtn = document.getElementById('clear-all');

// Poblar selector de spots desde el catálogo real de la app
SPOTS.forEach((s) => {
  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = `${s.name} (${s.zoneName || s.zone})`;
  spotSelect.appendChild(opt);
});

// Fecha/hora actual por defecto, en huso horario local
(function initDatetime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  datetimeInput.value = local;
})();

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveSessions(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* sin almacenamiento disponible */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function spotName(id) {
  return SPOTS.find((s) => s.id === id)?.name || id;
}

function issueUrl(entry) {
  const title = `Reporte: ${spotName(entry.spotId)} · ${entry.calidad} · ${entry.datetime ? entry.datetime.slice(0, 10) : ''}`;
  const body = [
    `Spot: ${spotName(entry.spotId)}`,
    `Fecha y hora: ${entry.datetime || '-'}`,
    `Calidad percibida: ${entry.calidad}`,
    `Tamaño percibido: ${entry.tamano}`,
    entry.comentario ? `Comentario: ${entry.comentario}` : null,
    '',
    '_Enviado desde el formulario de reporte de MeteoSurf_Cs._'
  ].filter(Boolean).join('\n');
  return `${REPO_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function qualityClass(calidad) {
  const map = { Plato: 'r0', Malo: 'r2', Regular: 'r4', Bueno: 'r6', 'Épico': 'r7' };
  return map[calidad] || 'r0';
}

function renderHistory() {
  const sessions = loadSessions().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  clearAllBtn.classList.toggle('hidden', sessions.length === 0);
  if (!sessions.length) {
    historyEl.innerHTML = '<div class="empty-state">Todavía no has guardado ningún reporte. Rellena el formulario de arriba después de tu próxima sesión.</div>';
    return;
  }
  historyEl.innerHTML = sessions.map((entry) => `
    <div class="session-item" data-id="${esc(entry.id)}">
      <div class="session-top">
        <span class="session-spot">${esc(spotName(entry.spotId))}</span>
        <span class="session-date num">${esc(fmtDate(entry.datetime))}</span>
      </div>
      <div class="session-meta">
        <span class="rating-pill ${qualityClass(entry.calidad)}">${esc(entry.calidad)}</span>
        <span class="chip">${esc(entry.tamano)}</span>
      </div>
      ${entry.comentario ? `<div class="session-note">${esc(entry.comentario)}</div>` : ''}
      <div class="session-actions">
        <a class="btn-ghost" href="${issueUrl(entry)}" target="_blank" rel="noopener">
          <svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>
          Enviar al registro
        </a>
        <button type="button" class="btn-ghost danger" data-del="${esc(entry.id)}">Borrar</button>
      </div>
    </div>
  `).join('');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const calidad = fd.get('calidad');
  const spot = fd.get('spot');
  if (!spot || !calidad) {
    form.reportValidity?.();
    return;
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    spotId: spot,
    datetime: fd.get('datetime') || '',
    calidad,
    tamano: fd.get('tamano') || '',
    comentario: (fd.get('comentario') || '').toString().trim(),
    createdAt: new Date().toISOString()
  };
  const sessions = loadSessions();
  sessions.push(entry);
  saveSessions(sessions);
  renderHistory();
  form.reset();
  document.querySelectorAll('.tile input[type="radio"]').forEach((r) => { r.checked = false; });
  spotSelect.value = spot; // conservar el spot seleccionado para la siguiente sesión
  document.getElementById('history').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

historyEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  const id = btn.getAttribute('data-del');
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
  renderHistory();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos tus reportes guardados en este dispositivo?')) return;
  saveSessions([]);
  renderHistory();
});

renderHistory();
