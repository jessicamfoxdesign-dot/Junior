/**
 * Shrinks a photo for upload and for the reader: longest side 1600px, JPEG.
 * The scale on the jar stays sharp at this size and the upload stays small.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read that photo"))), "image/jpeg", 0.85),
  );
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { blob, dataUrl };
}

/**
 * When the photo was probably taken. A photo picked from the library carries
 * its file date; one that is clearly old or in the future falls back to now.
 */
export function photoTime(file: File): Date {
  const t = file.lastModified;
  const now = Date.now();
  return t && t <= now + 60_000 && now - t < 3 * 86_400_000 ? new Date(t) : new Date(now);
}
