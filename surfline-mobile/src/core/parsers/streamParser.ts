import { WEBCAMS_DATA, STREAMS_DATA, Webcam } from '../../data/webcamsData';
import { SPOTS } from '../../data/spotsData';
import { haversineDistance } from '../physics/haversine';

export interface ResolvedStream {
  id: string;
  name: string;
  short: string;
  spotId: string;
  priority: number;
  type: 'hls' | 'mjpeg' | 'jpg' | 'iframe' | 'skyline' | 'restricted';
  streamUrl: string;
  fallbackUrl?: string;
  credit?: string;
  isDirect: boolean;
  distanceKm?: number;
  isZoneFallback?: boolean;
  zoneDistanceKm?: number;
  zoneSourceSpotId?: string;
}

function resolveWebcam(cam: Webcam, spotId: string): ResolvedStream {
  let url = cam.embedUrl;
  let fallbackUrl: string | undefined;

  // Si es la cámara del club (surfers_castellon), verificar si hay stream HLS dinámico resuelto
  if (cam.id === 'surfers_castellon' || cam.id === 'surfers_castellon_hls') {
    const dynamic = (STREAMS_DATA as Record<string, any>)?.surfers_castellon_hls;
    if (dynamic && dynamic.ok && dynamic.hls) {
      url = dynamic.hls;
      fallbackUrl = dynamic.snapshot;
    }
  }

  return {
    id: cam.id,
    name: cam.name,
    short: cam.short,
    spotId,
    priority: cam.priority,
    type: cam.embedType,
    streamUrl: url,
    fallbackUrl,
    credit: cam.credit,
    isDirect: cam.embedType === 'hls' || cam.embedType === 'skyline',
    distanceKm: cam.distanceKm,
  };
}

/**
 * Cámara más cercana que cubre otro spot, usada como vista de zona cuando el
 * spot consultado no tiene cámara propia. Nunca se presenta como cámara exacta.
 */
function findNearestZoneStream(spotId: string): ResolvedStream | null {
  const target = SPOTS.find((s) => s.id === spotId);
  if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) return null;

  let bestCam: Webcam | null = null;
  let bestSpotId: string | null = null;
  let bestKm = Infinity;

  for (const cam of WEBCAMS_DATA) {
    if (!cam.enabled) continue;
    for (const coveredId of cam.spots) {
      if (coveredId === spotId) continue;
      const covered = SPOTS.find((s) => s.id === coveredId);
      if (!covered || !Number.isFinite(covered.lat) || !Number.isFinite(covered.lon)) continue;
      const km = haversineDistance(target.lat, target.lon, covered.lat, covered.lon);
      if (km < bestKm) {
        bestKm = km;
        bestCam = cam;
        bestSpotId = coveredId;
      }
    }
  }

  if (!bestCam || !bestSpotId || !Number.isFinite(bestKm)) return null;

  const resolved = resolveWebcam(bestCam, spotId);
  return {
    ...resolved,
    isZoneFallback: true,
    zoneDistanceKm: Math.round(bestKm * 10) / 10,
    zoneSourceSpotId: bestSpotId,
  };
}

/**
 * Resuelve y ordena las cámaras disponibles para un spot determinado.
 * Prioriza emisiones HLS directas y compatibles con expo-video en móvil.
 * Si el spot no tiene cámara propia, devuelve la cámara de zona más cercana
 * marcada con isZoneFallback para no confundirla con una vista exacta.
 */
export function getStreamsForSpot(spotId: string): ResolvedStream[] {
  const matching = WEBCAMS_DATA.filter((w) => w.enabled && w.spots.includes(spotId));

  // Ordenar por prioridad (menor número = mayor prioridad)
  matching.sort((a, b) => a.priority - b.priority);

  if (matching.length === 0) {
    const zone = findNearestZoneStream(spotId);
    return zone ? [zone] : [];
  }

  return matching.map((cam) => resolveWebcam(cam, spotId));
}

/**
 * Obtiene la cámara principal recomendada para un spot.
 */
export function getPrimaryStreamForSpot(spotId: string): ResolvedStream | null {
  const streams = getStreamsForSpot(spotId);
  return streams.length > 0 ? streams[0] : null;
}
