import storage from './storageAdapter';
import { SpotForecastResult } from '../../core/parsers/forecastParser';

const FORECAST_CACHE_PREFIX = 'spot_forecast_';

export async function saveForecastToCache(forecast: SpotForecastResult): Promise<void> {
  const key = `${FORECAST_CACHE_PREFIX}${forecast.spotId}`;
  await storage.set(key, JSON.stringify(forecast));
}

export async function getForecastFromCache(spotId: string): Promise<SpotForecastResult | null> {
  const key = `${FORECAST_CACHE_PREFIX}${spotId}`;
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotForecastResult;
  } catch {
    return null;
  }
}
