// Downscale a large map photo in the browser before upload. Phone photos are
// often 4000+ px / several MB, which can time out / hit upload limits on small
// hosts. We resize to a sensible max dimension and re-encode as JPEG so the
// upload is small and fast. The map CV pipeline works fine at ~2000px.
//
// If anything goes wrong (unsupported format, decode failure), we fall back to
// the original file so the upload still attempts.

export async function downscaleImage(
  file: File,
  maxDim = 2200,
  quality = 0.85
): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    // Already small enough and not an oversized file — leave it.
    if (scale >= 1 && file.size < 2_500_000) {
      bitmap.close?.();
      return file;
    }
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
