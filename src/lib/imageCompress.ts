// Resizes + re-encodes an image before it ever touches the network or the
// offline queue. A modern phone photo is often 3-8MB; this gets typical
// shots down to 150-400KB with no visible quality loss at chat-bubble size,
// which matters a lot when "offline, sync later" means syncing over a weak
// signal the moment it appears.
const MAX_DIMENSION = 1600;
const QUALITY = 0.8;

export async function compressImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    return blob ?? file;
  } catch {
    // If compression fails for any reason (unsupported format, etc.), fall
    // back to sending the original rather than blocking the send.
    return file;
  }
}
