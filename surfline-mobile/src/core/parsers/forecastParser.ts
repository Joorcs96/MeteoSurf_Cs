import { SPOTS, Spot } from '../../data/spotsData';
import { calculateSurfFromTrains, SurfHeight } from '../physics/breakerHeight';
import { calculateWindState, WindState } from '../physics/windPenalty';
import { calculateWavePower, SwellEnergy } from '../physics/swellDecomposition';
import { rateWave, SpotRating } from '../physics/waveQuality';

export interface HourlyForecast {
  time: string; // ISO string o '2026-10-27T10:00'
  hour: number;
  surfHeight: SurfHeight;
  period: number;
  waveDirection: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  windState: WindState;
  energy: SwellEnergy;
  rating: SpotRating;
}

export interface SpotForecastResult {
  spotId: string;
  spotName: string;
  updatedAt: string;
  isOffline: boolean;
  hours: HourlyForecast[];
  summary: {
    bestHour: number;
    maxStars: number;
    maxHeight: number;
    recommended: boolean;
  };
}

/**
 * Procesa la previsión hora a hora para un spot combinando física de rompiente, viento y estrellas.
 */
export function processSpotForecast(
  spot: Spot,
  marineHourly: {
    time: string[];
    wave_height: (number | null)[];
    wave_period: (number | null)[];
    wave_direction: (number | null)[];
  },
  weatherHourly: {
    time: string[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
  },
  isOffline = false
): SpotForecastResult {
  const hours: HourlyForecast[] = [];
  const times = marineHourly?.time || [];

  for (let i = 0; i < Math.min(times.length, 168); i++) {
    const timeStr = times[i];
    const h = marineHourly.wave_height?.[i] ?? 0;
    const t = marineHourly.wave_period?.[i] ?? 0;
    const dir = marineHourly.wave_direction?.[i] ?? spot.facing;

    const wSpeed = weatherHourly.wind_speed_10m?.[i] ?? 0;
    const wGust = weatherHourly.wind_gusts_10m?.[i] ?? wSpeed;
    const wDir = weatherHourly.wind_direction_10m?.[i] ?? 0;

    const surfHeight = calculateSurfFromTrains(
      spot.facing,
      spot.swellWindow,
      spot.exposureFactor,
      [{ h, t, dir }]
    );

    const windState = calculateWindState(
      spot.facing,
      wSpeed,
      wDir,
      wGust,
      spot.windShelter
    );

    const energy = calculateWavePower(h, t);

    const rating = rateWave(
      surfHeight,
      t,
      windState,
      wSpeed,
      wGust,
      spot.maxGood,
      spot.abrigoBonus,
      h
    );

    const parsedDate = new Date(timeStr);
    const hour = isNaN(parsedDate.getHours()) ? i % 24 : parsedDate.getHours();

    hours.push({
      time: timeStr,
      hour,
      surfHeight,
      period: t,
      waveDirection: dir,
      windSpeed: wSpeed,
      windGust: wGust,
      windDirection: wDir,
      windState,
      energy,
      rating,
    });
  }

  // Resumen del spot
  let maxStars = 0;
  let bestHour = 9;
  let maxHeight = 0;

  for (const item of hours) {
    if (item.rating.stars > maxStars) {
      maxStars = item.rating.stars;
      bestHour = item.hour;
    }
    if (item.surfHeight.max > maxHeight) {
      maxHeight = item.surfHeight.max;
    }
  }

  return {
    spotId: spot.id,
    spotName: spot.name,
    updatedAt: new Date().toISOString(),
    isOffline,
    hours,
    summary: {
      bestHour,
      maxStars,
      maxHeight,
      recommended: maxStars >= 3.5,
    },
  };
}

/**
 * Genera previsión sintética/medida para inicialización inmediata o sin conexión.
 */
export function generateOfflineForecast(spot: Spot): SpotForecastResult {
  const times: string[] = [];
  const waveHeights: number[] = [];
  const wavePeriods: number[] = [];
  const waveDirs: number[] = [];
  const windSpeeds: number[] = [];
  const windGusts: number[] = [];
  const windDirs: number[] = [];

  const now = new Date();
  for (let i = 0; i < 72; i++) {
    const d = new Date(now.getTime() + i * 3600 * 1000);
    times.push(d.toISOString());

    // Curva de oleaje mediterráneo típica (0.4m a 0.85m con periodo 5.5s)
    const factor = Math.sin((i / 24) * Math.PI) * 0.3 + 0.55;
    waveHeights.push(Number(factor.toFixed(2)));
    wavePeriods.push(5.8);
    waveDirs.push(spot.facing);

    // Terral por la mañana (9h), brisa de mar por la tarde (16h)
    const h = d.getHours();
    const isMorning = h >= 6 && h <= 11;
    windSpeeds.push(isMorning ? 8 : 16);
    windGusts.push(isMorning ? 12 : 24);
    windDirs.push(isMorning ? (spot.facing + 180) % 360 : spot.facing);
  }

  return processSpotForecast(
    spot,
    {
      time: times,
      wave_height: waveHeights,
      wave_period: wavePeriods,
      wave_direction: waveDirs,
    },
    {
      time: times,
      wind_speed_10m: windSpeeds,
      wind_gusts_10m: windGusts,
      wind_direction_10m: windDirs,
    },
    true
  );
}
