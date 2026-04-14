import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// expo-file-system types are incomplete - cacheDirectory exists at runtime
const cacheDirectory = (FileSystem as { cacheDirectory?: string | null }).cacheDirectory ?? null;

const joinPath = (base: string, entry: string) =>
  base.endsWith('/') ? `${base}${entry}` : `${base}/${entry}`;

async function getDirectorySize(path: string): Promise<number> {
  let totalSize = 0;
  let entries: string[] = [];

  try {
    entries = await FileSystem.readDirectoryAsync(path);
  } catch {
    return 0;
  }

  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = joinPath(path, entry);
      const info = await FileSystem.getInfoAsync(entryPath);
      if (!info.exists) return 0;
      if (info.isDirectory) {
        return getDirectorySize(entryPath);
      }
      return info.size ?? 0;
    }),
  );

  for (const size of sizes) {
    totalSize += size;
  }

  return totalSize;
}

export async function getCacheSize(): Promise<number> {
  if (Platform.OS === 'web' || !cacheDirectory) return 0;
  return getDirectorySize(cacheDirectory);
}

export async function clearCache(): Promise<void> {
  if (Platform.OS === 'web' || !cacheDirectory) return;
  const entries = await FileSystem.readDirectoryAsync(cacheDirectory);
  await Promise.all(
    entries.map((entry) =>
      FileSystem.deleteAsync(joinPath(cacheDirectory, entry), {
        idempotent: true,
      })
    ),
  );
}
