export interface LightroomResult {
  style_summary: string;
  confidence: "high" | "medium" | "low";
  light: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
  };
  color: {
    temperature: number;
    tint: number;
    vibrance: number;
    saturation: number;
  };
  tone_curve: {
    description: string;
    highlights: number;
    lights: number;
    darks: number;
    shadows: number;
  };
  hsl: {
    hue: HslChannels;
    saturation: HslChannels;
    luminance: HslChannels;
  };
  color_grading: {
    shadows_hue: number;
    shadows_saturation: number;
    midtones_hue: number;
    midtones_saturation: number;
    highlights_hue: number;
    highlights_saturation: number;
    blending: number;
    balance: number;
  };
  detail: {
    sharpening: number;
    noise_reduction: number;
    color_noise_reduction: number;
  };
  effects: {
    vignette_amount: number;
    vignette_midpoint: number;
    grain_amount: number;
    grain_size: number;
    grain_roughness: number;
  };
  calibration: {
    shadows_hue: number;
    red_hue: number;
    red_saturation: number;
    green_hue: number;
    green_saturation: number;
    blue_hue: number;
    blue_saturation: number;
  };
}

export interface HslChannels {
  red: number;
  orange: number;
  yellow: number;
  green: number;
  aqua: number;
  blue: number;
  purple: number;
  magenta: number;
}

export type HslTab = "hue" | "saturation" | "luminance";
