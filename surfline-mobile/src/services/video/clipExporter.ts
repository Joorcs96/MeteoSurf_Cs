import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export interface ExportClipResult {
  success: boolean;
  savedToGallery: boolean;
  shared: boolean;
  error?: string;
}

/**
 * Sanea la ruta local para evitar el error de iOS 18 con fragmentos de URL.
 */
export function sanitizeVideoUri(uri: string): string {
  return uri.replace(/#.*$/, '');
}

/**
 * Guarda un clip en el carrete de fotos solicitando únicamente permiso de escritura (writeOnly: true)
 * para cumplir estrictamente con las políticas de Google Play y Apple App Store.
 */
export async function saveClipToGallery(videoUri: string): Promise<boolean> {
  const cleanUri = sanitizeVideoUri(videoUri);
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      return false;
    }

    if (typeof (MediaLibrary as any).saveToLibraryAsync === 'function') {
      await (MediaLibrary as any).saveToLibraryAsync(cleanUri);
      return true;
    } else if (typeof (MediaLibrary as any).createAssetAsync === 'function') {
      await (MediaLibrary as any).createAssetAsync(cleanUri);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[clipExporter] Error al guardar en carrete:', err);
    return false;
  }
}

/**
 * Abre el diálogo nativo para compartir el clip por WhatsApp, Instagram, Telegram, etc.
 */
export async function shareClip(videoUri: string, title = 'Clip de ola - Surfline Castellón'): Promise<boolean> {
  const cleanUri = sanitizeVideoUri(videoUri);
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return false;
    }

    await Sharing.shareAsync(cleanUri, {
      dialogTitle: title,
      mimeType: 'video/mp4',
      UTI: 'public.mpeg-4',
    });
    return true;
  } catch (err) {
    console.warn('[clipExporter] Error al compartir clip:', err);
    return false;
  }
}
