type PhotoOptions = { maxWidth?: number; aspect?: number };
type PhotoCrop = { x: number; y: number; width: number; height: number };

export function dataUrlBytes(value: string) {
  const encoded = value.slice(value.indexOf(",") + 1);
  return Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

export function encodeJpeg(image: CanvasImageSource, crop: PhotoCrop, maxWidth: number, maxBytes: number) {
  if (maxBytes <= 0 || maxWidth <= 0 || crop.width <= 0 || crop.height <= 0) throw new Error("Invalid photo dimensions or limit");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ไม่สามารถประมวลผลรูปภาพได้ / Canvas unavailable");
  let width = Math.min(maxWidth, crop.width);
  const aspect = crop.width / crop.height;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(canvas.width / aspect));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL("image/jpeg", Math.max(0.46, 0.88 - attempt * 0.05));
    if (output.startsWith("data:image/jpeg;base64,") && dataUrlBytes(output) <= maxBytes) return output;
    width *= 0.78;
  }
  throw new Error("ย่อรูปให้อยู่ในขนาดที่กำหนดไม่สำเร็จ / Could not resize this photo");
}

export async function compressPhoto(file: File, maxBytes = 1024 * 1024, { maxWidth = 1280, aspect }: PhotoOptions = {}) {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|avif)$/i.test(file.name)) throw new Error("กรุณาเลือกไฟล์รูปภาพ / Choose a photo");
  let image: CanvasImageSource;
  let width: number;
  let height: number;
  let bitmap: ImageBitmap | undefined;
  let source: string | undefined;
  try {
    if (typeof createImageBitmap === "function") {
      try { bitmap = await createImageBitmap(file); } catch { /* Safari can decode some files through an image element instead. */ }
    }
    if (bitmap) { image = bitmap; width = bitmap.width; height = bitmap.height; }
    else {
      source = URL.createObjectURL(file);
      const element = new Image();
      await new Promise<void>((resolve, reject) => {
        element.onload = () => resolve();
        element.onerror = () => reject(new Error("เปิดรูปนี้ไม่ได้ กรุณาใช้ JPEG หรือ PNG / Could not decode this photo"));
        element.src = source!;
      });
      image = element; width = element.naturalWidth; height = element.naturalHeight;
    }
    const crop = { x: 0, y: 0, width, height };
    if (aspect && width / height > aspect) { crop.width = height * aspect; crop.x = (width - crop.width) / 2; }
    else if (aspect) { crop.height = width / aspect; crop.y = (height - crop.height) / 2; }
    const longestSideLimit = maxWidth * Math.min(1, crop.width / crop.height);
    return encodeJpeg(image, crop, longestSideLimit, maxBytes);
  } finally {
    bitmap?.close();
    if (source) URL.revokeObjectURL(source);
  }
}
