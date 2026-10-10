import { SPOTS } from './spots.js';
import { processSpot } from './forecast.js';

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat1 - lat2) * rad / 2) ** 2 + Math.cos(lat2 * rad) * Math.cos(lat1 * rad) * Math.sin((lon1 - lon2) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function aplicarNowcast(fc, realtime, ahora = new Date()) {
  if (!fc || !fc.spots || !fc.raw || !realtime) return;
  const wave = realtime?.oleaje?.principal;
  if (!wave || wave.altura_m == null || isNaN(wave.altura_m)) return;
  if (wave.lat == null || wave.lon == null) return;

  const ageMin = (ahora.getTime() - new Date(wave.fecha).getTime()) / 60000;
  if (ageMin < -5 || ageMin > 180 || wave.obsoleto) return;

  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(wave.fecha)).map((p) => [p.type, p.value]));
  const key = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;

  for (let i = 0; i < SPOTS.length; i++) {
    const spot = SPOTS[i];
    const dist = distanceKm(spot.lat, spot.lon, wave.lat, wave.lon);
    if (dist > 60) continue;

    const m = fc.raw.marine[i]?.hourly;
    const w = fc.raw.weather[i]?.hourly;
    const daily = fc.raw.weather[i]?.daily;
    if (!m || !w) continue;

    const obsIdx = m.time.findIndex(t => t.slice(0, 13) === key);
    if (obsIdx < 0) continue;

    const hModel = m.wave_height[obsIdx];
    if (hModel == null || hModel <= 0) continue;

    let ratio = wave.altura_m / hModel;
    ratio = Math.max(0.7, Math.min(1.6, ratio));
    if (Math.abs(ratio - 1) < 0.1) continue;

    const mMod = { ...m };
    const fieldsToScale = ['wave_height', 'swell_wave_height', 'secondary_swell_wave_height', 'wind_wave_height'];
    for (const f of fieldsToScale) {
      if (mMod[f]) mMod[f] = [...mMod[f]];
    }

    for (let k = obsIdx; k < mMod.time.length; k++) {
      const hDiff = k - obsIdx;
      if (hDiff >= 12) break;
      const weight = 1 - (hDiff / 12);
      const currentRatio = 1 + (ratio - 1) * weight;

      for (const f of fieldsToScale) {
        if (mMod[f] && mMod[f][k] != null) {
          mMod[f][k] = mMod[f][k] * currentRatio;
        }
      }
    }

    const newSpotFc = processSpot(spot, mMod, w, daily);
    for (let k = obsIdx; k < obsIdx + 12 && k < newSpotFc.hours.length; k++) {
      newSpotFc.hours[k].nowcastRatio = ratio;
    }

    fc.spots[spot.id] = newSpotFc;
  }
}
