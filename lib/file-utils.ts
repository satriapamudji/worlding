import { File } from 'expo-file-system';

export async function readFileAsUint8Array(uri: string): Promise<Uint8Array> {
  const file = new File(uri);
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export function inferContentTypeAndExtension(
  uri: string,
  fallbackType: string
): { contentType: string; extension: string } {
  const cleanUri = uri.split('#')[0]?.split('?')[0] ?? '';
  const rawExtension = cleanUri.includes('.') ? cleanUri.split('.').pop() : '';
  const extension = (rawExtension || '').toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return { contentType: 'image/jpeg', extension: 'jpg' };
    case 'png':
      return { contentType: 'image/png', extension: 'png' };
    case 'webp':
      return { contentType: 'image/webp', extension: 'webp' };
    case 'heic':
      return { contentType: 'image/heic', extension: 'heic' };
    case 'heif':
      return { contentType: 'image/heif', extension: 'heif' };
    case 'gif':
      return { contentType: 'image/gif', extension: 'gif' };
    case 'mp4':
      return { contentType: 'video/mp4', extension: 'mp4' };
    case 'mov':
      return { contentType: 'video/quicktime', extension: 'mov' };
    case 'm4v':
      return { contentType: 'video/mp4', extension: 'm4v' };
    default:
      if (fallbackType.includes('image')) {
        return { contentType: fallbackType, extension: 'jpg' };
      }
      if (fallbackType.includes('video')) {
        return { contentType: fallbackType, extension: 'mp4' };
      }
      return { contentType: fallbackType, extension: 'bin' };
  }
}
