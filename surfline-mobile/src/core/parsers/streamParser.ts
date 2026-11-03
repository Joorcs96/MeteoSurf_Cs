import { WEBCAMS_DATA, STREAMS_DATA, Webcam } from '../../data/webcamsData';

export interface ResolvedStream {
  id: string;
  name: string;
  short: string;
  spotId: string;
  priority: number;
  type: 'hls' | 'mjpeg' | 'jpg' | 'iframe' | 'skyline';
  streamUrl: string;
  fallbackUrl?: string;
  credit?: string;
  isDirect: boolean;
  distanceKm?: number;
}

/**
 * Resuelve y ordena las cámaras disponibles para un spot determinado.
 * Prioriza emisiones HLS directas y compatibles con expo-video en móvil.
 */
export function getStreamsForSpot(spotId: string): ResolvedStream[] {
  const matching = WEBCAMS_DATA.filter((w) => w.enabled && w.spots.includes(spotId));

  // Ordenar por prioridad (menor número = mayor prioridad)
  matching.sort((a, b) => a.priority - b.priority);

  const resolved: ResolvedStream[] = [];

  for (const cam of matching) {
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

    resolved.push({
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
    });
  }

  return resolved;
}

/**
 * Obtiene la cámara principal recomendada para un spot.
 */
export function getPrimaryStreamForSpot(spotId: string): ResolvedStream | null {
  const streams = getStreamsForSpot(spotId);
  return streams.length > 0 ? streams[0] : null;
}
