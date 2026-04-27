import type { LightroomResult } from "@/app/lib/types";

export async function compressToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIM = 2400;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve({
        base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1],
        mime: "image/jpeg",
      });
    };
    img.src = url;
  });
}

export function generateThumbnail(file: File): Promise<string>;
export function generateThumbnail(imageSrc: string): Promise<string>;
export function generateThumbnail(input: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    const url = typeof input === "string" ? input : URL.createObjectURL(input);
    const shouldRevoke = typeof input !== "string";

    img.onload = () => {
      if (shouldRevoke) URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const size = 120;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };

    img.src = url;
  });
}

export function buildFilterString(result: LightroomResult): string {
  const { light, color } = result;
  const brightness = 1 + light.exposure * 0.15;
  const contrast = 1 + light.contrast * 0.008;
  const saturation = 1 + color.saturation * 0.01 + color.vibrance * 0.005;
  const tempShift = (color.temperature - 5500) / 5500;
  const hueRotate = tempShift * -15 + color.tint * 0.1;
  const highlightAdj = 1 + light.highlights * 0.002;
  const shadowAdj = 1 + light.shadows * 0.002;
  const combinedBrightness = brightness * highlightAdj * shadowAdj;
  return [
    `brightness(${combinedBrightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${Math.max(0, saturation).toFixed(3)})`,
    `hue-rotate(${hueRotate.toFixed(1)}deg)`,
  ].join(" ");
}

