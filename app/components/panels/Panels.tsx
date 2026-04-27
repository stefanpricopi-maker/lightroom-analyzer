"use client";

import { useState } from "react";
import { Slider } from "@/app/components/ui/Slider";
import { Section } from "@/app/components/ui/Section";
import { ColorGradingWheel } from "@/app/components/ui/ColorGradingWheel";
import type { LightroomResult, HslTab } from "@/app/lib/types";

const HSL_COLORS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;

// Helper: deep-set a nested value and return new object
function setIn<T extends object>(obj: T, path: string[], val: number): T {
  if (path.length === 1) return { ...obj, [path[0]]: val };
  const key = path[0] as keyof T;
  return { ...obj, [key]: setIn(obj[key] as object, path.slice(1), val) };
}

interface PanelProps {
  data: LightroomResult[keyof LightroomResult];
  original?: LightroomResult[keyof LightroomResult];
  onUpdate?: (path: string[], value: number) => void;
}

function HSLPanel({
  hsl, originalHsl, onUpdate,
}: {
  hsl: LightroomResult["hsl"];
  originalHsl?: LightroomResult["hsl"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  const [tab, setTab] = useState<HslTab>("hue");
  return (
    <div>
      <div className="flex border-b mb-3" style={{borderColor:"var(--border-2)"}}>
        {(["hue", "saturation", "luminance"] as HslTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3.5 py-1.5 text-[11px] tracking-[0.1em] uppercase bg-transparent border-none cursor-pointer transition-colors -mb-px"
            style={{
              color: tab === t ? "var(--accent)" : "var(--text-3)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {HSL_COLORS.map((color) => (
        <Slider
          key={color}
          label={color}
          value={hsl[tab][color]}
          originalValue={originalHsl?.[tab][color]}
          min={-100}
          max={100}
          onChange={onUpdate ? (v) => onUpdate(["hsl", tab, color], v) : undefined}
        />
      ))}
    </div>
  );
}

export function LightPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["light"];
  original?: LightroomResult["light"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Light" icon="◐">
      <Slider label="Exposure" value={data.exposure} originalValue={original?.exposure} min={-5} max={5} step={0.1} onChange={onUpdate ? (v) => onUpdate(["light", "exposure"], v) : undefined} />
      <Slider label="Contrast" value={data.contrast} originalValue={original?.contrast} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["light", "contrast"], v) : undefined} />
      <Slider label="Highlights" value={data.highlights} originalValue={original?.highlights} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["light", "highlights"], v) : undefined} />
      <Slider label="Shadows" value={data.shadows} originalValue={original?.shadows} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["light", "shadows"], v) : undefined} />
      <Slider label="Whites" value={data.whites} originalValue={original?.whites} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["light", "whites"], v) : undefined} />
      <Slider label="Blacks" value={data.blacks} originalValue={original?.blacks} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["light", "blacks"], v) : undefined} />
    </Section>
  );
}

export function ColorPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["color"];
  original?: LightroomResult["color"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Color" icon="◍">
      <Slider label="Temp" value={data.temperature} originalValue={original?.temperature} min={2000} max={50000} step={100} unit="K" onChange={onUpdate ? (v) => onUpdate(["color", "temperature"], v) : undefined} />
      <Slider label="Tint" value={data.tint} originalValue={original?.tint} min={-150} max={150} onChange={onUpdate ? (v) => onUpdate(["color", "tint"], v) : undefined} />
      <Slider label="Vibrance" value={data.vibrance} originalValue={original?.vibrance} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["color", "vibrance"], v) : undefined} />
      <Slider label="Saturation" value={data.saturation} originalValue={original?.saturation} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["color", "saturation"], v) : undefined} />
    </Section>
  );
}



export function HSLPanel_Wrapped({
  data, original, onUpdate,
}: {
  data: LightroomResult["hsl"];
  original?: LightroomResult["hsl"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="HSL / Color" icon="◉">
      <HSLPanel hsl={data} originalHsl={original} onUpdate={onUpdate} />
    </Section>
  );
}

export function ColorGradingPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["color_grading"];
  original?: LightroomResult["color_grading"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Color Grading" icon="◈">
      <div className="grid grid-cols-3 gap-2 mt-2">
        <ColorGradingWheel hue={data.shadows_hue} saturation={data.shadows_saturation} label="Shadows" />
        <ColorGradingWheel hue={data.midtones_hue} saturation={data.midtones_saturation} label="Midtones" />
        <ColorGradingWheel hue={data.highlights_hue} saturation={data.highlights_saturation} label="Highlights" />
      </div>
      <div className="mt-4">
        <Slider label="Blending" value={data.blending} originalValue={original?.blending} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["color_grading", "blending"], v) : undefined} />
        <Slider label="Balance" value={data.balance} originalValue={original?.balance} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["color_grading", "balance"], v) : undefined} />
      </div>
    </Section>
  );
}

export function DetailPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["detail"];
  original?: LightroomResult["detail"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Detail" icon="◫">
      <Slider label="Sharpening" value={data.sharpening} originalValue={original?.sharpening} min={0} max={150} onChange={onUpdate ? (v) => onUpdate(["detail", "sharpening"], v) : undefined} />
      <Slider label="Noise Reduc." value={data.noise_reduction} originalValue={original?.noise_reduction} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["detail", "noise_reduction"], v) : undefined} />
      <Slider label="Color Noise" value={data.color_noise_reduction} originalValue={original?.color_noise_reduction} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["detail", "color_noise_reduction"], v) : undefined} />
    </Section>
  );
}

export function EffectsPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["effects"];
  original?: LightroomResult["effects"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Effects" icon="◎">
      <Slider label="Vignette" value={data.vignette_amount} originalValue={original?.vignette_amount} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["effects", "vignette_amount"], v) : undefined} />
      <Slider label="Midpoint" value={data.vignette_midpoint} originalValue={original?.vignette_midpoint} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["effects", "vignette_midpoint"], v) : undefined} />
      <Slider label="Grain" value={data.grain_amount} originalValue={original?.grain_amount} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["effects", "grain_amount"], v) : undefined} />
      <Slider label="Grain Size" value={data.grain_size} originalValue={original?.grain_size} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["effects", "grain_size"], v) : undefined} />
      <Slider label="Roughness" value={data.grain_roughness} originalValue={original?.grain_roughness} min={0} max={100} onChange={onUpdate ? (v) => onUpdate(["effects", "grain_roughness"], v) : undefined} />
    </Section>
  );
}

export function CalibrationPanel({
  data, original, onUpdate,
}: {
  data: LightroomResult["calibration"];
  original?: LightroomResult["calibration"];
  onUpdate?: (path: string[], value: number) => void;
}) {
  return (
    <Section title="Calibration" icon="◳">
      <Slider label="Shadow Hue" value={data.shadows_hue} originalValue={original?.shadows_hue} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "shadows_hue"], v) : undefined} />
      <Slider label="Red Hue" value={data.red_hue} originalValue={original?.red_hue} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "red_hue"], v) : undefined} />
      <Slider label="Red Sat." value={data.red_saturation} originalValue={original?.red_saturation} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "red_saturation"], v) : undefined} />
      <Slider label="Green Hue" value={data.green_hue} originalValue={original?.green_hue} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "green_hue"], v) : undefined} />
      <Slider label="Green Sat." value={data.green_saturation} originalValue={original?.green_saturation} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "green_saturation"], v) : undefined} />
      <Slider label="Blue Hue" value={data.blue_hue} originalValue={original?.blue_hue} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "blue_hue"], v) : undefined} />
      <Slider label="Blue Sat." value={data.blue_saturation} originalValue={original?.blue_saturation} min={-100} max={100} onChange={onUpdate ? (v) => onUpdate(["calibration", "blue_saturation"], v) : undefined} />
    </Section>
  );
}

export { setIn };
