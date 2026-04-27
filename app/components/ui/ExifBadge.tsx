"use client";

import type { ExifData } from "@/app/lib/exif";

interface ExifBadgeProps {
  exif: ExifData;
}

interface BadgeItemProps {
  label: string;
  value: string;
}

function BadgeItem({ label, value }: BadgeItemProps) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)" }}>
      <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--text-4)" }}>{label}</span>
      <span className="font-syne font-semibold text-[13px] mt-0.5" style={{ color: "var(--text-1)" }}>{value}</span>
    </div>
  );
}

export function ExifBadge({ exif }: ExifBadgeProps) {
  const items: BadgeItemProps[] = [];

  if (exif.aperture)     items.push({ label: "Aperture", value: exif.aperture });
  if (exif.shutterSpeed) items.push({ label: "Shutter", value: exif.shutterSpeed });
  if (exif.iso)          items.push({ label: "ISO", value: exif.iso.replace("ISO ", "") });
  if (exif.focalLength)  items.push({ label: "Focal", value: exif.focalLength });
  if (exif.exposureBias && exif.exposureBias !== "0 EV") items.push({ label: "Exp. Bias", value: exif.exposureBias });

  if (items.length === 0) return null;

  const camera = [exif.make, exif.model].filter(Boolean).join(" ").replace(exif.make ?? "", "").trim() || exif.model || exif.make;

  return (
    <div className="mt-3">
      {camera && (
        <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text-3)" }}>
          📷 {[exif.make, exif.model].filter(Boolean).join(" ")}
          {exif.dateTime && <span style={{ color: "var(--text-4)" }}> · {exif.dateTime.split(" ")[0].replace(/:/g, "/")}</span>}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {items.map((item) => (
          <BadgeItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}
