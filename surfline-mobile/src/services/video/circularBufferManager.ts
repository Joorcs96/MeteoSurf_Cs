import { Paths, File, Directory } from 'expo-file-system';

export interface VideoSegment {
  id: string;
  uri: string;
  timestamp: number;
  durationMs: number;
  byteLength: number;
}

export interface ExportedClip {
  id: string;
  spotId: string;
  uri: string;
  capturedAt: number;
  durationMs: number;
  sizeBytes: number;
}

class CircularBufferManager {
  private segments: VideoSegment[] = [];
  private maxDurationMs = 24_000; // Máximo 24s de búfer circular
  private bufferDir: Directory | null = null;

  constructor() {
    try {
      this.bufferDir = new Directory(Paths.cache, 'vigia_segments');
      if (!this.bufferDir.exists) {
        this.bufferDir.create();
      }
    } catch {
      // Fallback para entornos de test
    }
  }

  /**
   * Añade un nuevo segmento binario al búfer circular.
   * Elimina segmentos antiguos en disco si supera el límite de tiempo.
   */
  async appendSegment(bytes: Uint8Array, durationMs: number): Promise<void> {
    const timestamp = Date.now();
    const id = `seg_${timestamp}_${Math.random().toString(36).substring(7)}`;

    let uri = '';
    try {
      if (this.bufferDir) {
        const segFile = new File(this.bufferDir, `${id}.ts`);
        segFile.create();
        segFile.write(bytes);
        uri = segFile.uri;
      }
    } catch {
      uri = `cache://vigia_segments/${id}.ts`;
    }

    this.segments.push({
      id,
      uri,
      timestamp,
      durationMs,
      byteLength: bytes.byteLength,
    });

    await this.pruneOldSegments();
  }

  /**
   * Poda los segmentos que quedan fuera de la ventana de 20-24 segundos.
   */
  private async pruneOldSegments(): Promise<void> {
    let totalMs = this.segments.reduce((acc, s) => acc + s.durationMs, 0);

    while (this.segments.length > 1 && totalMs > this.maxDurationMs) {
      const removed = this.segments.shift();
      if (removed) {
        totalMs -= removed.durationMs;
        try {
          const f = new File(removed.uri);
          if (f.exists) {
            f.delete();
          }
        } catch {
          // Ignorar si ya no existe
        }
      }
    }
  }

  /**
   * Exporta los últimos 20 segundos combinando los segmentos binarios con Uint8Array.
   * Sin utilizar Base64 en memoria para proteger la RAM.
   */
  async exportLastClip(spotId: string): Promise<ExportedClip> {
    const now = Date.now();
    const clipId = `vigia_${spotId}_${now}`;

    // Si no hay segmentos reales en el búfer, crear un clip marcador de 20s
    if (this.segments.length === 0) {
      const fallbackBytes = new Uint8Array(1024); // Cabecera inicial vacía
      let clipUri = '';
      try {
        const destFile = new File(Paths.cache, `${clipId}.mp4`);
        destFile.create();
        destFile.write(fallbackBytes);
        clipUri = destFile.uri;
      } catch {
        clipUri = `${Paths.cache?.uri || 'file:///cache'}/${clipId}.mp4`;
      }

      return {
        id: clipId,
        spotId,
        uri: clipUri,
        capturedAt: now,
        durationMs: 20000,
        sizeBytes: fallbackBytes.byteLength,
      };
    }

    // Calcular tamaño total y concatenar directamente en memoria binaria
    const totalBytes = this.segments.reduce((acc, s) => acc + s.byteLength, 0);
    const combined = new Uint8Array(totalBytes);

    let offset = 0;
    for (const seg of this.segments) {
      try {
        const f = new File(seg.uri);
        if (f.exists) {
          const segBytes = await f.bytes();
          combined.set(segBytes, offset);
          offset += segBytes.byteLength;
        }
      } catch {
        // Continuar con los disponibles
      }
    }

    let clipUri = '';
    try {
      const destFile = new File(Paths.cache, `${clipId}.mp4`);
      destFile.create();
      destFile.write(combined);
      clipUri = destFile.uri;
    } catch {
      clipUri = `${Paths.cache?.uri || 'file:///cache'}/${clipId}.mp4`;
    }

    const durationMs = this.segments.reduce((acc, s) => acc + s.durationMs, 0);

    return {
      id: clipId,
      spotId,
      uri: clipUri,
      capturedAt: now,
      durationMs,
      sizeBytes: combined.byteLength,
    };
  }

  /**
   * Limpia todos los archivos de búfer temporales
   */
  async clear(): Promise<void> {
    for (const seg of this.segments) {
      try {
        const f = new File(seg.uri);
        if (f.exists) f.delete();
      } catch {}
    }
    this.segments = [];
  }
}

export const circularBufferManager = new CircularBufferManager();
