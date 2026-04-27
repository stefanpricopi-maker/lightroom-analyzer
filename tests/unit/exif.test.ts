import { describe, it, expect } from "vitest";
import {
  extractExif,
  formatShutter,
  formatAperture,
  formatFocalLength,
  formatExposureBias,
} from "@/app/lib/exif";

// ─── Formatting functions ────────────────────────────────────────────────────

describe("formatShutter", () => {
  it("formats fast shutter speeds as fractions", () => {
    expect(formatShutter(1 / 200)).toBe("1/200s");
    expect(formatShutter(1 / 1000)).toBe("1/1000s");
    expect(formatShutter(1 / 60)).toBe("1/60s");
  });

  it("formats slow shutter as fraction when under 1s", () => {
    expect(formatShutter(1 / 2)).toBe("1/2s");
    expect(formatShutter(1 / 4)).toBe("1/4s");
  });

  it("formats long exposures with decimal seconds", () => {
    expect(formatShutter(1)).toBe("1.0s");
    expect(formatShutter(2.5)).toBe("2.5s");
    expect(formatShutter(30)).toBe("30.0s");
  });
});

describe("formatAperture", () => {
  it("formats aperture with f/ prefix and one decimal", () => {
    expect(formatAperture(2.8)).toBe("f/2.8");
    expect(formatAperture(1.8)).toBe("f/1.8");
    expect(formatAperture(16)).toBe("f/16.0");
    expect(formatAperture(5.6)).toBe("f/5.6");
  });
});

describe("formatFocalLength", () => {
  it("formats focal length in mm rounded to nearest integer", () => {
    expect(formatFocalLength(50)).toBe("50mm");
    expect(formatFocalLength(24.5)).toBe("25mm");
    expect(formatFocalLength(200)).toBe("200mm");
    expect(formatFocalLength(17.3)).toBe("17mm");
  });
});

describe("formatExposureBias", () => {
  it("shows 0 EV for zero bias", () => {
    expect(formatExposureBias(0)).toBe("0 EV");
  });

  it("adds + prefix for positive bias", () => {
    expect(formatExposureBias(1)).toBe("+1.0 EV");
    expect(formatExposureBias(0.3)).toBe("+0.3 EV");
  });

  it("shows negative bias without + prefix", () => {
    expect(formatExposureBias(-1)).toBe("-1.0 EV");
    expect(formatExposureBias(-0.7)).toBe("-0.7 EV");
  });
});

// ─── Binary buffer helpers ───────────────────────────────────────────────────

// Build a minimal JPEG+EXIF buffer with known values for testing
function buildExifBuffer(tags: Array<{ tag: number; type: number; value: number | number[] | string }>): ArrayBuffer {
  // We build everything in little-endian (Intel byte order)

  // Encode tags into IFD entries + data area
  const entries: Array<{ tag: number; type: number; count: number; inlineValue?: number; dataOffset?: number; dataBytes?: Uint8Array }> = [];
  const dataChunks: Uint8Array[] = [];
  let dataAreaSize = 0;

  for (const t of tags) {
    if (typeof t.value === "string") {
      const bytes = new Uint8Array(t.value.length + 1); // null terminated
      for (let i = 0; i < t.value.length; i++) bytes[i] = t.value.charCodeAt(i);
      entries.push({ tag: t.tag, type: 2, count: bytes.length, dataOffset: dataAreaSize, dataBytes: bytes });
      dataChunks.push(bytes);
      dataAreaSize += bytes.length;
    } else if (t.type === 3) {
      // SHORT — inline
      entries.push({ tag: t.tag, type: 3, count: 1, inlineValue: t.value as number });
    } else if (t.type === 4) {
      // LONG — inline
      entries.push({ tag: t.tag, type: 4, count: 1, inlineValue: t.value as number });
    } else if (t.type === 5) {
      // RATIONAL — 8 bytes (numerator + denominator)
      const [num, den] = t.value as number[];
      const bytes = new Uint8Array(8);
      const dv = new DataView(bytes.buffer);
      dv.setUint32(0, num, true);
      dv.setUint32(4, den, true);
      entries.push({ tag: t.tag, type: 5, count: 1, dataOffset: dataAreaSize, dataBytes: bytes });
      dataChunks.push(bytes);
      dataAreaSize += 8;
    } else if (t.type === 10) {
      // SRATIONAL — 8 bytes (signed)
      const [num, den] = t.value as number[];
      const bytes = new Uint8Array(8);
      const dv = new DataView(bytes.buffer);
      dv.setInt32(0, num, true);
      dv.setInt32(4, den, true);
      entries.push({ tag: t.tag, type: 10, count: 1, dataOffset: dataAreaSize, dataBytes: bytes });
      dataChunks.push(bytes);
      dataAreaSize += 8;
    }
  }

  // IFD size: 2 (count) + n*12 (entries) + 4 (next IFD offset = 0)
  const ifdSize = 2 + entries.length * 12 + 4;
  // TIFF header: 8 bytes (II, 42, IFD offset)
  const tiffHeaderSize = 8;
  // IFD offset from TIFF start = 8
  const ifdOffset = tiffHeaderSize;
  // Data area starts after IFD
  const dataAreaOffset = ifdOffset + ifdSize;

  // Total TIFF block size
  const tiffSize = tiffHeaderSize + ifdSize + dataAreaSize;

  // EXIF header: "Exif\0\0" = 6 bytes
  const exifHeaderSize = 6;

  // APP1 content = exifHeader + tiff
  const app1ContentSize = exifHeaderSize + tiffSize;

  // APP1 segment: FF E1 + 2-byte length (includes length bytes) + content
  const app1Size = 2 + 2 + app1ContentSize;

  // Full buffer: FF D8 (SOI) + APP1
  const totalSize = 2 + app1Size;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  let pos = 0;

  // SOI
  view.setUint16(pos, 0xFFD8); pos += 2;

  // APP1 marker
  view.setUint16(pos, 0xFFE1); pos += 2;
  // APP1 length (includes the 2 length bytes)
  view.setUint16(pos, 2 + app1ContentSize); pos += 2;

  // "Exif\0\0"
  "Exif".split("").forEach(ch => { view.setUint8(pos++, ch.charCodeAt(0)); });
  view.setUint8(pos++, 0);
  view.setUint8(pos++, 0);

  // TIFF: byte order "II" (little endian)
  const tiffBase = pos;
  view.setUint16(pos, 0x4949, true); pos += 2;
  // TIFF magic 42
  view.setUint16(pos, 42, true); pos += 2;
  // IFD0 offset from TIFF start = 8
  view.setUint32(pos, ifdOffset, true); pos += 4;

  // IFD entry count
  view.setUint16(pos, entries.length, true); pos += 2;

  // IFD entries
  for (const entry of entries) {
    view.setUint16(pos, entry.tag, true); pos += 2;
    view.setUint16(pos, entry.type, true); pos += 2;
    view.setUint32(pos, entry.count, true); pos += 4;
    if (entry.inlineValue !== undefined) {
      if (entry.type === 3) view.setUint16(pos, entry.inlineValue, true);
      else if (entry.type === 4) view.setUint32(pos, entry.inlineValue, true);
      pos += 4;
    } else {
      // Offset from TIFF start to data
      view.setUint32(pos, dataAreaOffset + entry.dataOffset!, true); pos += 4;
    }
  }

  // Next IFD offset = 0 (no more IFDs)
  view.setUint32(pos, 0, true); pos += 4;

  // Data area
  for (const chunk of dataChunks) {
    for (let i = 0; i < chunk.length; i++) view.setUint8(pos++, chunk[i]);
  }

  return buf;
}

// Build a buffer that is NOT a JPEG
function nonJpegBuffer(): ArrayBuffer {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint16(0, 0x8950); // PNG magic
  return buf;
}

// Build a JPEG with no APP1 segment
function jpegNoExif(): ArrayBuffer {
  const buf = new ArrayBuffer(6);
  const view = new DataView(buf);
  view.setUint16(0, 0xFFD8); // SOI
  view.setUint16(2, 0xFFDA); // SOS — triggers early exit
  view.setUint16(4, 0x0002);
  return buf;
}

// ─── extractExif edge cases ──────────────────────────────────────────────────

describe("extractExif — edge cases", () => {
  it("returns empty object for empty buffer", () => {
    expect(extractExif(new ArrayBuffer(0))).toEqual({});
  });

  it("returns empty object for buffer too small to be JPEG", () => {
    expect(extractExif(new ArrayBuffer(1))).toEqual({});
  });

  it("returns empty object for non-JPEG file", () => {
    expect(extractExif(nonJpegBuffer())).toEqual({});
  });

  it("returns empty object for JPEG with no EXIF segment", () => {
    expect(extractExif(jpegNoExif())).toEqual({});
  });

  it("returns empty object for buffer with only SOI", () => {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, 0xFFD8);
    expect(extractExif(buf)).toEqual({});
  });
});

// ─── extractExif with synthetic EXIF data ───────────────────────────────────

describe("extractExif — camera make and model", () => {
  it("reads Make tag", () => {
    const buf = buildExifBuffer([
      { tag: 0x010F, type: 2, value: "Canon" },
    ]);
    expect(extractExif(buf).make).toBe("Canon");
  });

  it("reads Model tag", () => {
    const buf = buildExifBuffer([
      { tag: 0x0110, type: 2, value: "EOS R5" },
    ]);
    expect(extractExif(buf).model).toBe("EOS R5");
  });

  it("reads both Make and Model", () => {
    const buf = buildExifBuffer([
      { tag: 0x010F, type: 2, value: "Sony" },
      { tag: 0x0110, type: 2, value: "A7 IV" },
    ]);
    const result = extractExif(buf);
    expect(result.make).toBe("Sony");
    expect(result.model).toBe("A7 IV");
  });

  it("trims whitespace from string fields", () => {
    const buf = buildExifBuffer([
      { tag: 0x010F, type: 2, value: "Nikon  " },
    ]);
    expect(extractExif(buf).make).toBe("Nikon");
  });
});

describe("extractExif — exposure settings", () => {
  it("reads ISO as SHORT type", () => {
    const buf = buildExifBuffer([
      { tag: 0x8827, type: 3, value: 400 },
    ]);
    expect(extractExif(buf).iso).toBe("ISO 400");
  });

  it("reads ISO 100", () => {
    const buf = buildExifBuffer([{ tag: 0x8827, type: 3, value: 100 }]);
    expect(extractExif(buf).iso).toBe("ISO 100");
  });

  it("reads ISO 3200", () => {
    const buf = buildExifBuffer([{ tag: 0x8827, type: 3, value: 3200 }]);
    expect(extractExif(buf).iso).toBe("ISO 3200");
  });

  it("reads shutter speed as RATIONAL (1/200)", () => {
    const buf = buildExifBuffer([
      { tag: 0x829A, type: 5, value: [1, 200] },
    ]);
    expect(extractExif(buf).shutterSpeed).toBe("1/200s");
  });

  it("reads shutter speed as RATIONAL (1/60)", () => {
    const buf = buildExifBuffer([
      { tag: 0x829A, type: 5, value: [1, 60] },
    ]);
    expect(extractExif(buf).shutterSpeed).toBe("1/60s");
  });

  it("reads long exposure shutter speed (2s)", () => {
    const buf = buildExifBuffer([
      { tag: 0x829A, type: 5, value: [2, 1] },
    ]);
    expect(extractExif(buf).shutterSpeed).toBe("2.0s");
  });

  it("reads aperture as RATIONAL (f/2.8)", () => {
    const buf = buildExifBuffer([
      { tag: 0x829D, type: 5, value: [28, 10] },
    ]);
    expect(extractExif(buf).aperture).toBe("f/2.8");
  });

  it("reads aperture f/1.8", () => {
    const buf = buildExifBuffer([
      { tag: 0x829D, type: 5, value: [18, 10] },
    ]);
    expect(extractExif(buf).aperture).toBe("f/1.8");
  });
});

describe("extractExif — focal length", () => {
  it("reads focal length as RATIONAL (50mm)", () => {
    const buf = buildExifBuffer([
      { tag: 0x920A, type: 5, value: [50, 1] },
    ]);
    expect(extractExif(buf).focalLength).toBe("50mm");
  });

  it("reads fractional focal length (24.5mm → 25mm)", () => {
    const buf = buildExifBuffer([
      { tag: 0x920A, type: 5, value: [245, 10] },
    ]);
    expect(extractExif(buf).focalLength).toBe("25mm");
  });
});

describe("extractExif — exposure bias", () => {
  it("reads zero exposure bias", () => {
    const buf = buildExifBuffer([
      { tag: 0x9204, type: 10, value: [0, 1] },
    ]);
    expect(extractExif(buf).exposureBias).toBe("0 EV");
  });

  it("reads positive exposure bias (+1 EV)", () => {
    const buf = buildExifBuffer([
      { tag: 0x9204, type: 10, value: [1, 1] },
    ]);
    expect(extractExif(buf).exposureBias).toBe("+1.0 EV");
  });

  it("reads negative exposure bias (-0.7 EV)", () => {
    const buf = buildExifBuffer([
      { tag: 0x9204, type: 10, value: [-7, 10] },
    ]);
    expect(extractExif(buf).exposureBias).toBe("-0.7 EV");
  });
});

describe("extractExif — flash and white balance", () => {
  it("reads flash fired", () => {
    const buf = buildExifBuffer([
      { tag: 0x9209, type: 3, value: 0x01 }, // bit 0 set = fired
    ]);
    expect(extractExif(buf).flash).toBe("Flash fired");
  });

  it("reads no flash", () => {
    const buf = buildExifBuffer([
      { tag: 0x9209, type: 3, value: 0x00 },
    ]);
    expect(extractExif(buf).flash).toBe("No flash");
  });

  it("reads auto white balance", () => {
    const buf = buildExifBuffer([
      { tag: 0xA001, type: 3, value: 0 },
    ]);
    expect(extractExif(buf).whiteBalance).toBe("Auto");
  });

  it("reads manual white balance", () => {
    const buf = buildExifBuffer([
      { tag: 0xA001, type: 3, value: 1 },
    ]);
    expect(extractExif(buf).whiteBalance).toBe("Manual");
  });
});

describe("extractExif — date and dimensions", () => {
  it("reads dateTime string", () => {
    const buf = buildExifBuffer([
      { tag: 0x0132, type: 2, value: "2024:03:15 14:30:00" },
    ]);
    expect(extractExif(buf).dateTime).toBe("2024:03:15 14:30:00");
  });

  it("reads image width as SHORT", () => {
    const buf = buildExifBuffer([
      { tag: 0xA002, type: 3, value: 6000 },
    ]);
    expect(extractExif(buf).width).toBe("6000");
  });

  it("reads image height as SHORT", () => {
    const buf = buildExifBuffer([
      { tag: 0xA003, type: 3, value: 4000 },
    ]);
    expect(extractExif(buf).height).toBe("4000");
  });
});

describe("extractExif — multiple fields together", () => {
  it("reads a realistic set of camera metadata", () => {
    const buf = buildExifBuffer([
      { tag: 0x010F, type: 2, value: "Canon" },
      { tag: 0x0110, type: 2, value: "EOS R5" },
      { tag: 0x8827, type: 3, value: 800 },
      { tag: 0x829A, type: 5, value: [1, 250] },
      { tag: 0x829D, type: 5, value: [28, 10] },
      { tag: 0x920A, type: 5, value: [85, 1] },
    ]);
    const result = extractExif(buf);
    expect(result.make).toBe("Canon");
    expect(result.model).toBe("EOS R5");
    expect(result.iso).toBe("ISO 800");
    expect(result.shutterSpeed).toBe("1/250s");
    expect(result.aperture).toBe("f/2.8");
    expect(result.focalLength).toBe("85mm");
  });

  it("returns only fields present — undefined for missing ones", () => {
    const buf = buildExifBuffer([
      { tag: 0x8827, type: 3, value: 400 },
    ]);
    const result = extractExif(buf);
    expect(result.iso).toBe("ISO 400");
    expect(result.make).toBeUndefined();
    expect(result.aperture).toBeUndefined();
    expect(result.focalLength).toBeUndefined();
  });
});

describe("extractExif — rational edge cases", () => {
  it("handles denominator of zero in rational gracefully", () => {
    // shutter speed with denominator 0 → should not throw
    const buf = buildExifBuffer([
      { tag: 0x829A, type: 5, value: [1, 0] },
    ]);
    // Should not throw — returns "1/..." based on 0 value
    expect(() => extractExif(buf)).not.toThrow();
  });
});