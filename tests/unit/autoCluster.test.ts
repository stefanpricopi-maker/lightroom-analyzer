import { describe, it, expect } from "vitest";
import { parseExifDate, formatGroupName, clusterByTime } from "@/app/lib/autoCluster";
import type { BatchItem } from "@/app/lib/batchTypes";

// ─── parseExifDate ───────────────────────────────────────────────────────────

describe("parseExifDate", () => {
  it("parses a valid EXIF date string", () => {
    const d = parseExifDate("2024:03:15 14:30:00");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it("returns null for undefined input", () => {
    expect(parseExifDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseExifDate("")).toBeNull();
  });

  it("returns null for wrong format", () => {
    expect(parseExifDate("2024-03-15 14:30:00")).toBeNull();
    expect(parseExifDate("15/03/2024")).toBeNull();
    expect(parseExifDate("not a date")).toBeNull();
  });

  it("parses midnight correctly", () => {
    const d = parseExifDate("2024:01:01 00:00:00");
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it("parses end of day correctly", () => {
    const d = parseExifDate("2024:12:31 23:59:59");
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(23);
    expect(d!.getMinutes()).toBe(59);
  });
});

// ─── formatGroupName ─────────────────────────────────────────────────────────

describe("formatGroupName", () => {
  it("returns 'Scene N' when no start date", () => {
    expect(formatGroupName(null, null, 0)).toBe("Scene 1");
    expect(formatGroupName(null, null, 2)).toBe("Scene 3");
  });

  it("includes date and time when start is provided", () => {
    const d = new Date(2024, 2, 15, 14, 30, 0);
    const name = formatGroupName(d, null, 0);
    // Check it contains some time representation (locale-agnostic)
    expect(name).toMatch(/\d{1,2}:\d{2}/);
    // Check it contains a month name or number
    expect(name.length).toBeGreaterThan(5);
  });
});

// ─── clusterByTime ───────────────────────────────────────────────────────────

function makeItem(id: string): BatchItem {
  return {
    id,
    file: new File([], `${id}.jpg`, { type: "image/jpeg" }),
    thumbnail: "",
    status: "waiting",
  };
}

function withDate(item: BatchItem, date: Date | null) {
  return { item, date };
}

describe("clusterByTime — basic clustering", () => {
  it("returns single group when all items are within threshold", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 5 * 60 * 1000)),  // +5 min
      withDate(makeItem("c"), new Date(base.getTime() + 10 * 60 * 1000)), // +10 min
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(3);
  });

  it("splits into two groups when gap exceeds threshold", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 5 * 60 * 1000)),   // +5 min
      withDate(makeItem("c"), new Date(base.getTime() + 45 * 60 * 1000)), // +45 min (gap > 20)
      withDate(makeItem("d"), new Date(base.getTime() + 50 * 60 * 1000)), // +50 min
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(2);
    expect(result[0].items).toHaveLength(2);
    expect(result[1].items).toHaveLength(2);
  });

  it("splits each item into its own group when all gaps exceed threshold", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 60 * 60 * 1000)),  // +1h
      withDate(makeItem("c"), new Date(base.getTime() + 120 * 60 * 1000)), // +2h
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(3);
    result.forEach((g) => expect(g.items).toHaveLength(1));
  });

  it("sorts items chronologically before clustering", () => {
    const base = new Date("2024-03-15T10:00:00");
    // Deliberately out of order
    const items = [
      withDate(makeItem("c"), new Date(base.getTime() + 10 * 60 * 1000)),
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 5 * 60 * 1000)),
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
    expect(result[0].items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("clusterByTime — threshold sensitivity", () => {
  it("uses exact threshold boundary — gap equal to threshold does NOT split", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 20 * 60 * 1000)), // exactly 20 min
    ];
    // Gap is exactly threshold — should NOT split (gap > threshold, not >=)
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
  });

  it("splits when gap is 1ms over threshold", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 20 * 60 * 1000 + 1)), // 20min + 1ms
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(2);
  });

  it("fine threshold (5 min) creates more groups", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("a"), new Date(base.getTime())),
      withDate(makeItem("b"), new Date(base.getTime() + 10 * 60 * 1000)), // +10 min
      withDate(makeItem("c"), new Date(base.getTime() + 20 * 60 * 1000)), // +20 min
    ];
    const fine = clusterByTime(items, 5);
    const coarse = clusterByTime(items, 25);
    expect(fine.length).toBeGreaterThan(coarse.length);
  });
});

describe("clusterByTime — edge cases", () => {
  it("returns single group with all items when no EXIF dates", () => {
    const items = [
      withDate(makeItem("a"), null),
      withDate(makeItem("b"), null),
      withDate(makeItem("c"), null),
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(3);
    expect(result[0].name).toBe("Scene 1");
  });

  it("appends undated items to last group", () => {
    const base = new Date("2024-03-15T10:00:00");
    const items = [
      withDate(makeItem("dated1"), new Date(base.getTime())),
      withDate(makeItem("dated2"), new Date(base.getTime() + 5 * 60 * 1000)),
      withDate(makeItem("undated"), null),
    ];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(3);
    expect(result[0].items.find((i) => i.id === "undated")).toBeTruthy();
  });

  it("handles single item", () => {
    const items = [withDate(makeItem("a"), new Date())];
    const result = clusterByTime(items, 20);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = clusterByTime([], 20);
    expect(result).toHaveLength(0);
  });

  it("groups have correct start and end times", () => {
    const base = new Date("2024-03-15T10:00:00");
    const t1 = new Date(base.getTime());
    const t2 = new Date(base.getTime() + 5 * 60 * 1000);
    const items = [
      withDate(makeItem("a"), t1),
      withDate(makeItem("b"), t2),
    ];
    const result = clusterByTime(items, 20);
    expect(result[0].startTime).toEqual(t1);
    expect(result[0].endTime).toEqual(t2);
  });

  it("multi-day event splits correctly across midnight", () => {
    const day1 = new Date("2024-03-15T23:50:00");
    const day2 = new Date("2024-03-16T00:30:00"); // 40 min later
    const items = [
      withDate(makeItem("last-shot-day1"), day1),
      withDate(makeItem("first-shot-day2"), day2),
    ];
    const result = clusterByTime(items, 20); // 40 min gap > 20 min threshold
    expect(result).toHaveLength(2);
  });
});