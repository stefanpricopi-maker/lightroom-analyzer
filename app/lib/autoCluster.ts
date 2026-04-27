import { extractExif, readFileAsBuffer } from "@/app/lib/exif";
import type { BatchItem } from "@/app/lib/batchTypes";

export interface ClusteredGroup {
  name: string;
  items: BatchItem[];
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * Parse an EXIF dateTime string "YYYY:MM:DD HH:MM:SS" into a Date object.
 * Returns null if the string is missing or malformed.
 */
export function parseExifDate(dateTime: string | undefined): Date | null {
  if (!dateTime) return null;
  // EXIF format: "2024:03:15 14:30:00"
  const match = dateTime.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec] = match;
  const d = new Date(
    parseInt(year), parseInt(month) - 1, parseInt(day),
    parseInt(hour), parseInt(min), parseInt(sec)
  );
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date range as a human-readable group name.
 * e.g. "10:30 – 11:45" or "Mar 15 · 10:30 – Mar 16 · 08:00"
 */
export function formatGroupName(start: Date | null, end: Date | null, index: number): string {
  if (!start) return `Scene ${index + 1}`;

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDay = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });

  if (!end || start.toDateString() === end.toDateString()) {
    return `${fmtDay(start)} · ${fmt(start)}${end ? ` – ${fmt(end)}` : ""}`;
  }
  return `${fmtDay(start)} ${fmt(start)} – ${fmtDay(end)} ${fmt(end)}`;
}

export interface ItemWithDate {
  item: BatchItem;
  date: Date | null;
}

/**
 * Read EXIF dates from all items in parallel.
 */
export async function readItemDates(items: BatchItem[]): Promise<ItemWithDate[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const buf = await readFileAsBuffer(item.file);
        const exif = extractExif(buf);
        return { item, date: parseExifDate(exif.dateTime) };
      } catch {
        return { item, date: null };
      }
    })
  );
}

/**
 * Cluster items into groups based on a time gap threshold (minutes).
 * Items without dates are appended to the last group or a catch-all group.
 * Items are sorted chronologically before clustering.
 */
export function clusterByTime(
  itemsWithDates: ItemWithDate[],
  thresholdMinutes: number
): ClusteredGroup[] {
  const thresholdMs = thresholdMinutes * 60 * 1000;

  // Separate dated and undated items
  const dated = itemsWithDates.filter((i) => i.date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());
  const undated = itemsWithDates.filter((i) => i.date === null);

  if (itemsWithDates.length === 0) return [];

  if (dated.length === 0) {
    // No EXIF dates — return single group with all items
    return [{
      name: "Scene 1",
      items: itemsWithDates.map((i) => i.item),
      startTime: null,
      endTime: null,
    }];
  }

  const groups: ClusteredGroup[] = [];
  let current: ItemWithDate[] = [dated[0]];

  for (let i = 1; i < dated.length; i++) {
    const prev = dated[i - 1].date!;
    const curr = dated[i].date!;
    const gap = curr.getTime() - prev.getTime();

    if (gap > thresholdMs) {
      // Start a new group
      groups.push(buildGroup(current, groups.length));
      current = [dated[i]];
    } else {
      current.push(dated[i]);
    }
  }
  // Push last group
  if (current.length > 0) groups.push(buildGroup(current, groups.length));

  // Append undated items to the last group
  if (undated.length > 0 && groups.length > 0) {
    groups[groups.length - 1].items.push(...undated.map((i) => i.item));
  } else if (undated.length > 0) {
    groups.push({ name: "Undated", items: undated.map((i) => i.item), startTime: null, endTime: null });
  }

  return groups;
}

function buildGroup(items: ItemWithDate[], index: number): ClusteredGroup {
  const dates = items.map((i) => i.date!);
  const start = dates[0];
  const end = dates[dates.length - 1];
  return {
    name: formatGroupName(start, end, index),
    items: items.map((i) => i.item),
    startTime: start,
    endTime: end,
  };
}