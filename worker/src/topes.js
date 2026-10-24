// Topes duros del contrato. Se aplican aqui, en el Worker, aunque el motor
// de avisos se equivoque: el dia se cuenta en hora de Madrid.

import { ahoraMadrid } from './hora.js';
import { PREFS_POR_DEFECTO, MAX_POR_DIA_TECHO } from './prefs.js';

export const HORAS_DEDUPE = 6 * 3600;
export const PREFIJO_SUBS = 'sub:';

/** Registro nuevo, tal y como se guarda en KV. */
export function registroNuevo(id, endpoint, keys, prefs, ahora) {
  return {
    id,
    endpoint,
    keys,
    prefs,
    creado: ahora.unix,
    dia: ahora.fecha,
    enviadosHoy: 0,
    ultimoPorTag: {}
  };
}

/** Si el registro es de un dia anterior, se reinicia el contador diario. */
export function conDiaActual(registro, ahora = ahoraMadrid()) {
  const reg = { ...registro, ultimoPorTag: { ...(registro.ultimoPorTag || {}) } };
  if (reg.dia !== ahora.fecha) {
    reg.dia = ahora.fecha;
    reg.enviadosHoy = 0;
    reg.ultimoPorTag = {};
  }
  return reg;
}

/** true si la hora actual cae en las horas de silencio. */
export function enSilencio(prefs, ahora) {
  const q = (prefs && prefs.quiet) || PREFS_POR_DEFECTO.quiet;
  const from = Number.isInteger(q.from) ? q.from : PREFS_POR_DEFECTO.quiet.from;
  const to = Number.isInteger(q.to) ? q.to : PREFS_POR_DEFECTO.quiet.to;
  if (from === to) return false;
  const hora = ahora.hora;
  return from > to ? hora >= from || hora < to : hora >= from && hora < to;
}

export function maximoDelDia(prefs) {
  const v = prefs && Number.isInteger(prefs.maxPerDay) ? prefs.maxPerDay : PREFS_POR_DEFECTO.maxPerDay;
  return Math.min(Math.max(v, 1), MAX_POR_DIA_TECHO);
}

export function duplicado(registro, tag, ahora) {
  if (!tag) return false;
  const ultimo = (registro.ultimoPorTag || {})[tag];
  if (typeof ultimo !== 'number') return false;
  return ahora.unix - ultimo < HORAS_DEDUPE;
}

/**
 * Decision previa al envio. Devuelve {ok:true} o {ok:false, motivo:'cap'|'quiet'|'dup'}.
 * El orden es el del contrato: primero el tope diario, luego el silencio y el repetido.
 */
export function puedeEnviar(registro, prefs, tag, ahora = ahoraMadrid()) {
  const reg = conDiaActual(registro, ahora);
  const p = prefs || reg.prefs || PREFS_POR_DEFECTO;
  if (reg.enviadosHoy >= maximoDelDia(p)) return { ok: false, motivo: 'cap' };
  if (enSilencio(p, ahora)) return { ok: false, motivo: 'quiet' };
  if (duplicado(reg, tag, ahora)) return { ok: false, motivo: 'dup' };
  return { ok: true, motivo: 'ok' };
}

/** Suma un envio al registro y apunta el tag. */
export function contarEnvio(registro, tag, ahora = ahoraMadrid()) {
  const reg = conDiaActual(registro, ahora);
  reg.enviadosHoy += 1;
  reg.ultimoPorTag = { ...reg.ultimoPorTag };
  if (tag) reg.ultimoPorTag[tag] = ahora.unix;
  return reg;
}

/** Vista publica para GET /subs: ni endpoint ni claves. */
export function vistaPublica(registro, ahora = ahoraMadrid()) {
  const reg = conDiaActual(registro, ahora);
  return {
    id: reg.id,
    prefs: reg.prefs,
    sentToday: reg.enviadosHoy,
    lastByTag: reg.ultimoPorTag
  };
}