// Saneado de preferencias. Nunca dejamos que un cliente ensucie el registro:
// fuera de rango se cae al valor por defecto y se anota en `avisos`.

export const TIPOS_AVISO = ['gente', 'olas_ahora', 'olas_tarde', 'dias_buenos'];

export const PREFS_POR_DEFECTO = Object.freeze({
  spots: [],
  alerts: { gente: true, olas_ahora: true, olas_tarde: true, dias_buenos: true },
  minStars: 3,
  quiet: { from: 22, to: 8 },
  maxPerDay: 2
});

export const MAX_POR_DIA_TECHO = 3;
export const MAX_SPOTS = 12;

const RE_SPOT = /^[a-z0-9_-]{1,40}$/;

function enteroEnRango(valor, min, max, porDefecto, avisos, nombre) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    if (valor !== undefined && valor !== null) avisos.push(`${nombre} fuera de rango (${min}-${max})`);
    return porDefecto;
  }
  return n;
}

// El tope diario se ajusta en lugar de caer al valor por defecto: pedir 9 no
// significa "no quiero avisos", significa "quiero el maximo", y el maximo es 3.
function enteroAjustado(valor, min, max, porDefecto, avisos, nombre) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
    if (valor !== undefined && valor !== null) avisos.push(`${nombre} no es un entero`);
    return porDefecto;
  }
  if (n < min || n > max) avisos.push(`${nombre} se ajusta al rango ${min}-${max}`);
  return Math.min(Math.max(n, min), max);
}

/**
 * Devuelve las preferencias ya saneadas. Nunca lanza: cualquier cosa rara se
 * convierte en el valor por defecto, que es la opcion conservadora.
 */
export function sanearPrefs(bruto) {
  const avisos = [];
  const entrada = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {};

  let spots = [];
  if (Array.isArray(entrada.spots)) {
    spots = [];
    for (const s of entrada.spots) {
      if (typeof s !== 'string') continue;
      const limpio = s.trim().toLowerCase();
      if (!RE_SPOT.test(limpio)) {
        avisos.push('spot ignorado');
        continue;
      }
      if (!spots.includes(limpio)) spots.push(limpio);
      if (spots.length >= MAX_SPOTS) {
        avisos.push(`mas de ${MAX_SPOTS} spots: se cortan`);
        break;
      }
    }
  } else if (entrada.spots !== undefined && entrada.spots !== null) {
    avisos.push('spots no es una lista');
  }

  const alerts = { ...PREFS_POR_DEFECTO.alerts };
  if (entrada.alerts && typeof entrada.alerts === 'object' && !Array.isArray(entrada.alerts)) {
    for (const tipo of TIPOS_AVISO) {
      if (tipo in entrada.alerts) {
        if (typeof entrada.alerts[tipo] === 'boolean') alerts[tipo] = entrada.alerts[tipo];
        else avisos.push(`alerts.${tipo} no es booleano`);
      }
    }
  } else if (entrada.alerts !== undefined && entrada.alerts !== null) {
    avisos.push('alerts no es un objeto');
  }

  const prefs = {
    spots,
    alerts,
    minStars: enteroEnRango(entrada.minStars, 1, 7, PREFS_POR_DEFECTO.minStars, avisos, 'minStars'),
    quiet: { ...PREFS_POR_DEFECTO.quiet },
    maxPerDay: enteroAjustado(
      entrada.maxPerDay,
      1,
      MAX_POR_DIA_TECHO,
      PREFS_POR_DEFECTO.maxPerDay,
      avisos,
      'maxPerDay'
    )
  };

  if (entrada.quiet && typeof entrada.quiet === 'object' && !Array.isArray(entrada.quiet)) {
    prefs.quiet = {
      from: enteroEnRango(entrada.quiet.from, 0, 23, PREFS_POR_DEFECTO.quiet.from, avisos, 'quiet.from'),
      to: enteroEnRango(entrada.quiet.to, 0, 23, PREFS_POR_DEFECTO.quiet.to, avisos, 'quiet.to')
    };
  } else if (entrada.quiet !== undefined && entrada.quiet !== null) {
    avisos.push('quiet no es un objeto');
  }

  return { prefs, avisos };
}