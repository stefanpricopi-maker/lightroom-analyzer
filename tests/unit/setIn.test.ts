import { describe, it, expect } from "vitest";
import { setIn } from "@/app/components/panels/Panels";

describe("setIn", () => {
  it("sets a top-level key", () => {
    const obj = { a: 1, b: 2 };
    expect(setIn(obj, ["a"], 99)).toEqual({ a: 99, b: 2 });
  });

  it("sets a nested key", () => {
    const obj = { light: { exposure: 0, contrast: 10 } };
    expect(setIn(obj, ["light", "exposure"], 1.5)).toEqual({
      light: { exposure: 1.5, contrast: 10 },
    });
  });

  it("sets a deeply nested key", () => {
    const obj = { hsl: { hue: { red: 0, orange: 5 } } };
    expect(setIn(obj, ["hsl", "hue", "red"], 15)).toEqual({
      hsl: { hue: { red: 15, orange: 5 } },
    });
  });

  it("does not mutate the original object", () => {
    const obj = { light: { exposure: 0 } };
    const result = setIn(obj, ["light", "exposure"], 2);
    expect(obj.light.exposure).toBe(0);
    expect(result.light.exposure).toBe(2);
  });

  it("preserves unrelated keys", () => {
    const obj = { light: { exposure: 0, contrast: 10, highlights: -20 } };
    const result = setIn(obj, ["light", "exposure"], 1);
    expect(result.light.contrast).toBe(10);
    expect(result.light.highlights).toBe(-20);
  });
});