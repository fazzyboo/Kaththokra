/*
  On-phone image prep (SRS DX-1, DX-8): accept JPEG/PNG/WebP ≤ 5 MB, resize the long edge to
  512 px and re-encode as JPEG ≤ 150 KB. Drawing to a canvas also drops EXIF (location, device).
*/
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type PreparedImage = { blob: Blob; url: string; width: number; height: number; bytes: number };

export type ImageError = "type" | "size" | "decode";

export async function prepareImage(file: File): Promise<PreparedImage | ImageError> {
  if (!ACCEPTED.includes(file.type)) return "type";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "decode";
  }
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "decode";
  ctx.drawImage(bitmap, 0, 0, w, h);

  let quality = 0.85;
  let blob: Blob | null = null;
  while (quality >= 0.4) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= 150 * 1024) break;
    quality -= 0.1;
  }
  if (!blob) return "decode";
  return { blob, url: URL.createObjectURL(blob), width: w, height: h, bytes: blob.size };
}

/** A drawn sample leaf so the flow can be demoed on a laptop without a camera. */
export const SAMPLE_LEAF =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#8a7a55"/><rect width="400" height="300" fill="#6f8f4e" opacity=".35"/><path d="M20 250C120 170 260 80 390 40 330 120 220 220 40 262z" fill="#5d9a3f"/><path d="M30 255C150 180 270 100 380 46" stroke="#3f7a2a" stroke-width="3" fill="none"/><g fill="#d8d2b8" stroke="#7a4b23" stroke-width="3"><ellipse cx="150" cy="190" rx="16" ry="7" transform="rotate(-30 150 190)"/><ellipse cx="230" cy="140" rx="20" ry="8" transform="rotate(-32 230 140)"/><ellipse cx="300" cy="100" rx="13" ry="6" transform="rotate(-34 300 100)"/></g></svg>`,
  );
