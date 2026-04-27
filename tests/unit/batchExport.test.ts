import { describe, it, expect } from "vitest";
import { getBaseName, getSidecarName } from "@/app/lib/batchExport";

describe("getBaseName", () => {
  it("removes jpg extension", () => {
    expect(getBaseName("DSC_001.jpg")).toBe("DSC_001");
  });

  it("removes JPG uppercase extension", () => {
    expect(getBaseName("DSC_001.JPG")).toBe("DSC_001");
  });

  it("removes RAW extension", () => {
    expect(getBaseName("photo.RAW")).toBe("photo");
  });

  it("removes png extension", () => {
    expect(getBaseName("wedding_001.png")).toBe("wedding_001");
  });

  it("handles filenames with dots in the name", () => {
    expect(getBaseName("my.photo.2024.jpg")).toBe("my.photo.2024");
  });

  it("handles filenames with spaces", () => {
    expect(getBaseName("my photo shot.jpg")).toBe("my photo shot");
  });

  it("handles filenames with no extension", () => {
    expect(getBaseName("DSC_001")).toBe("DSC_001");
  });

  it("trims whitespace", () => {
    expect(getBaseName("  DSC_001.jpg  ")).toBe("DSC_001");
  });
});

describe("getSidecarName", () => {
  it("replaces .jpg with .xmp", () => {
    expect(getSidecarName("DSC_001.jpg")).toBe("DSC_001.xmp");
  });

  it("replaces .JPG with .xmp", () => {
    expect(getSidecarName("DSC_001.JPG")).toBe("DSC_001.xmp");
  });

  it("replaces .png with .xmp", () => {
    expect(getSidecarName("wedding_001.png")).toBe("wedding_001.xmp");
  });

  it("replaces .RAW with .xmp", () => {
    expect(getSidecarName("photo.RAW")).toBe("photo.xmp");
  });

  it("replaces .webp with .xmp", () => {
    expect(getSidecarName("shot.webp")).toBe("shot.xmp");
  });

  it("handles filenames with multiple dots", () => {
    expect(getSidecarName("my.photo.2024.jpg")).toBe("my.photo.2024.xmp");
  });

  it("produces sidecar name matching original base name exactly", () => {
    const original = "DSC_1234_edited.jpg";
    const sidecar = getSidecarName(original);
    expect(sidecar).toBe("DSC_1234_edited.xmp");
    // Base name in sidecar must match base name of original
    expect(sidecar.replace(".xmp", "")).toBe(getBaseName(original));
  });

  it("handles filenames with no extension", () => {
    expect(getSidecarName("DSC_001")).toBe("DSC_001.xmp");
  });
});

describe("sidecar naming — Lightroom compatibility", () => {
  it("batch of files all get unique sidecar names", () => {
    const files = ["DSC_001.jpg", "DSC_002.jpg", "DSC_003.jpg"];
    const sidecars = files.map(getSidecarName);
    const unique = new Set(sidecars);
    expect(unique.size).toBe(files.length);
  });

  it("sidecar name has .xmp extension", () => {
    expect(getSidecarName("photo.jpg").endsWith(".xmp")).toBe(true);
    expect(getSidecarName("photo.RAW").endsWith(".xmp")).toBe(true);
    expect(getSidecarName("photo.png").endsWith(".xmp")).toBe(true);
  });

  it("sidecar name contains no path separators", () => {
    const sidecar = getSidecarName("DSC_001.jpg");
    expect(sidecar).not.toContain("/");
    expect(sidecar).not.toContain("\\");
  });
});