// Minimal EXIF reader — extracts key camera metadata from JPEG files
// Reads the APP1/Exif segment directly from the binary file

export interface ExifData {
  make?: string;
  model?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  exposureBias?: string;
  whiteBalance?: string;
  flash?: string;
  dateTime?: string;
  width?: string;
  height?: string;
}

function readUint16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

function readUint32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint32(offset, littleEndian);
}

function readString(view: DataView, offset: number, length: number): string {
  let str = "";
  for (let i = 0; i < length; i++) {
    const ch = view.getUint8(offset + i);
    if (ch === 0) break;
    str += String.fromCharCode(ch);
  }
  return str.trim();
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  const num = readUint32(view, offset, littleEndian);
  const den = readUint32(view, offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function readSignedRational(view: DataView, offset: number, littleEndian: boolean): number {
  const num = view.getInt32(offset, littleEndian);
  const den = view.getInt32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

export function formatShutter(value: number): string {
  if (value >= 1) return `${value.toFixed(1)}s`;
  const denom = Math.round(1 / value);
  return `1/${denom}s`;
}

export function formatAperture(value: number): string {
  return `f/${value.toFixed(1)}`;
}

export function formatFocalLength(value: number): string {
  return `${Math.round(value)}mm`;
}

export function formatExposureBias(value: number): string {
  if (value === 0) return "0 EV";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} EV`;
}

export function extractExif(buffer: ArrayBuffer): ExifData {
  const result: ExifData = {};

  // Buffer must be at least 2 bytes to read SOI marker
  if (buffer.byteLength < 2) return result;

  const view = new DataView(buffer);

  // Must start with JPEG SOI marker FF D8
  if (view.getUint16(0) !== 0xFFD8) return result;

  let offset = 2;
  const len = view.byteLength;

  // Scan for APP1 marker (FF E1)
  while (offset < len - 4) {
    const marker = view.getUint16(offset);
    if (marker === 0xFFE1) break;
    if (marker === 0xFFDA) return result; // Start of scan — no more metadata
    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }

  if (offset >= len - 4) return result;

  // APP1 segment found
  offset += 2; // skip marker
  const segLength = view.getUint16(offset);
  offset += 2;

  // Check "Exif\0\0" header
  const exifHeader = readString(view, offset, 6);
  if (!exifHeader.startsWith("Exif")) return result;
  offset += 6;

  const tiffStart = offset;

  // Byte order
  const byteOrder = view.getUint16(offset);
  const le = byteOrder === 0x4949; // 'II' = little endian

  // Verify TIFF magic
  if (readUint16(view, tiffStart + 2, le) !== 42) return result;

  // IFD0 offset
  const ifd0Offset = readUint32(view, tiffStart + 4, le);

  function readIFD(ifdOffset: number) {
    if (ifdOffset + 2 > len) return;
    const count = readUint16(view, tiffStart + ifdOffset, le);

    for (let i = 0; i < count; i++) {
      const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > len) break;

      const tag = readUint16(view, entryOffset, le);
      const type = readUint16(view, entryOffset + 2, le);
      const components = readUint32(view, entryOffset + 4, le);
      const valueOffset = entryOffset + 8;

      // Helper: get actual data location
      const dataSize = [0,1,1,2,4,8,0,0,2,4,8,4,8][type] ?? 1;
      const totalSize = dataSize * components;
      const dataOffset = totalSize > 4
        ? tiffStart + readUint32(view, valueOffset, le)
        : valueOffset;

      if (dataOffset + totalSize > len) continue;

      switch (tag) {
        case 0x010F: result.make = readString(view, dataOffset, components); break;
        case 0x0110: result.model = readString(view, dataOffset, components); break;
        case 0x0132: result.dateTime = readString(view, dataOffset, components); break;
        case 0xA002: result.width = String(type === 3 ? readUint16(view, dataOffset, le) : readUint32(view, dataOffset, le)); break;
        case 0xA003: result.height = String(type === 3 ? readUint16(view, dataOffset, le) : readUint32(view, dataOffset, le)); break;
        case 0x8769: { // Exif SubIFD
          const subOffset = readUint32(view, valueOffset, le);
          readIFD(subOffset);
          break;
        }
        case 0x829A: result.shutterSpeed = formatShutter(readRational(view, dataOffset, le)); break;
        case 0x829D: result.aperture = formatAperture(readRational(view, dataOffset, le)); break;
        case 0x8827: {
          const iso = type === 3 ? readUint16(view, dataOffset, le) : readUint32(view, dataOffset, le);
          result.iso = `ISO ${iso}`;
          break;
        }
        case 0x920A: result.focalLength = formatFocalLength(readRational(view, dataOffset, le)); break;
        case 0x9204: result.exposureBias = formatExposureBias(readSignedRational(view, dataOffset, le)); break;
        case 0xA20E: // FocalPlaneXResolution — skip
          break;
        case 0x9209: {
          const flashVal = type === 3 ? readUint16(view, dataOffset, le) : view.getUint8(dataOffset);
          result.flash = (flashVal & 1) ? "Flash fired" : "No flash";
          break;
        }
        case 0xA001: {
          const wb = type === 3 ? readUint16(view, dataOffset, le) : view.getUint8(dataOffset);
          result.whiteBalance = wb === 1 ? "Manual" : "Auto";
          break;
        }
      }
    }
  }

  readIFD(ifd0Offset);
  return result;
}

export function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}