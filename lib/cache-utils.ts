import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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
  const cacheDir = FileSystem.cacheDirectory;
  if (Platform.OS === 'web' || !cacheDir) return 0;
  return getDirectorySize(cacheDir);
}

export async function clearCache(): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (Platform.OS === 'web' || !cacheDir) return;
  const entries = await FileSystem.readDirectoryAsync(cacheDir);
  await Promise.all(
    entries.map((entry) =>
      FileSystem.deleteAsync(joinPath(cacheDir, entry), {
        idempotent: true,
      })
    ),
  );
}
