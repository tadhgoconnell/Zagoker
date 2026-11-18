/**
 * Profile photos are stored in the public "avatars" Storage bucket under
 * "<user id>/<file>". Profiles hold only that path; this builds the URL.
 */
export const PHOTO_BUCKET = "avatars";

export function photoUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Edge length of stored photos, in pixels. Small, because avatars are small. */
export const PHOTO_SIZE = 320;

/**
 * Turns any picture the browser can read into a square JPEG: centre-cropped,
 * scaled down, with location and other metadata dropped (re-encoding through
 * a canvas keeps only the pixels).
 */
export async function squarePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // honours the photo's rotation
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(PHOTO_SIZE, side);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save the photo."))), "image/jpeg", 0.86),
    );
  } finally {
    bitmap.close();
  }
}
