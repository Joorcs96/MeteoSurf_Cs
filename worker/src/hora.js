// Hora de Madrid (Europe/Madrid) sin depender del reloj del servidor.
// El Worker corre en UTC, asi que "hoy a las 23:30" se decide siempre en Madrid.

const ZONA = 'Europe/Madrid';

const formateador = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** Devuelve {fecha:'AAAA-MM-DD', hora:0-23, minuto:0-59, unix:segundos} en hora de Madrid. */
export function ahoraMadrid(fecha = new Date()) {
  const partes = Object.fromEntries(formateador.formatToParts(fecha).map((p) => [p.type, p.value]));
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    unix: Math.floor(fecha.getTime() / 1000)
  };
}

export function unix(fecha) {
  return Math.floor(fecha.getTime() / 1000);
}