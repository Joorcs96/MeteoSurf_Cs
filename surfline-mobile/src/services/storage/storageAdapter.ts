/**
 * Adaptador de almacenamiento dual.
 * MMKV en builds EAS (JSI síncrono, 60% más rápido).
 * AsyncStorage como fallback en Expo Go (sin puente nativo).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function createMMKVAdapter(): StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv');
  const instance = new MMKV({ id: 'surfline-store' });
  // Verificar que el puente JSI está activo
  instance.set('__probe__', '1');
  instance.delete('__probe__');
  return {
    get: async (key) => instance.getString(key) ?? null,
    set: async (key, value) => instance.set(key, value),
    delete: async (key) => instance.delete(key),
  };
}

function createAsyncStorageAdapter(): StorageAdapter {
  return {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    delete: (key) => AsyncStorage.removeItem(key),
  };
}

let _storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_storage) return _storage;
  try {
    _storage = createMMKVAdapter();
  } catch {
    _storage = createAsyncStorageAdapter();
  }
  return _storage;
}

export default getStorage();
