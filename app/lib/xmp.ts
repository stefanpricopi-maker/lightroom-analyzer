import type { LightroomResult } from "@/app/lib/types";

// Escape special XML characters to prevent injection in XMP attributes
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

// Sanitize filename: remove characters unsafe on Windows/Mac/Linux
export function sanitizeFilename(str: string): string {
  return (
    str
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 100)
      .trim() || "My_Preset"
  );
}

export function generateXMP(result: LightroomResult, presetName: string): string {
  const { light, color, tone_curve, hsl, detail, effects, color_grading, calibration } = result;
  const safeName = escapeXML(presetName) || "My Preset";

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    crs:ProcessVersion="11.0"
    crs:PresetType="Normal"
    crs:Pinned="False"
    crs:SupportsAmount="False"
    crs:SupportsColor="True"
    crs:SupportsMonochrome="False"
    crs:SupportsHighDynamicRange="True"
    crs:SupportsNormalDynamicRange="True"
    crs:SupportsSceneReferred="True"
    crs:SupportsOutputReferred="True"
    crs:CameraModelRestriction=""
    crs:Copyright=""
    crs:ContactInfo=""

    crs:Name="${safeName}"

    crs:Exposure2012="${light.exposure.toFixed(2)}"
    crs:Contrast2012="${light.contrast}"
    crs:Highlights2012="${light.highlights}"
    crs:Shadows2012="${light.shadows}"
    crs:Whites2012="${light.whites}"
    crs:Blacks2012="${light.blacks}"

    crs:WhiteBalance="Custom"
    crs:Temperature="${Math.round(color.temperature)}"
    crs:Tint="${color.tint}"
    crs:Vibrance="${color.vibrance}"
    crs:Saturation="${color.saturation}"

    crs:ParametricHighlights="${tone_curve.highlights}"
    crs:ParametricLights="${tone_curve.lights}"
    crs:ParametricDarks="${tone_curve.darks}"
    crs:ParametricShadows="${tone_curve.shadows}"
    crs:ParametricHighlightSplit="75"
    crs:ParametricMidtoneSplit="50"
    crs:ParametricShadowSplit="25"

    crs:HueAdjustmentRed="${hsl.hue.red}"
    crs:HueAdjustmentOrange="${hsl.hue.orange}"
    crs:HueAdjustmentYellow="${hsl.hue.yellow}"
    crs:HueAdjustmentGreen="${hsl.hue.green}"
    crs:HueAdjustmentAqua="${hsl.hue.aqua}"
    crs:HueAdjustmentBlue="${hsl.hue.blue}"
    crs:HueAdjustmentPurple="${hsl.hue.purple}"
    crs:HueAdjustmentMagenta="${hsl.hue.magenta}"

    crs:SaturationAdjustmentRed="${hsl.saturation.red}"
    crs:SaturationAdjustmentOrange="${hsl.saturation.orange}"
    crs:SaturationAdjustmentYellow="${hsl.saturation.yellow}"
    crs:SaturationAdjustmentGreen="${hsl.saturation.green}"
    crs:SaturationAdjustmentAqua="${hsl.saturation.aqua}"
    crs:SaturationAdjustmentBlue="${hsl.saturation.blue}"
    crs:SaturationAdjustmentPurple="${hsl.saturation.purple}"
    crs:SaturationAdjustmentMagenta="${hsl.saturation.magenta}"

    crs:LuminanceAdjustmentRed="${hsl.luminance.red}"
    crs:LuminanceAdjustmentOrange="${hsl.luminance.orange}"
    crs:LuminanceAdjustmentYellow="${hsl.luminance.yellow}"
    crs:LuminanceAdjustmentGreen="${hsl.luminance.green}"
    crs:LuminanceAdjustmentAqua="${hsl.luminance.aqua}"
    crs:LuminanceAdjustmentBlue="${hsl.luminance.blue}"
    crs:LuminanceAdjustmentPurple="${hsl.luminance.purple}"
    crs:LuminanceAdjustmentMagenta="${hsl.luminance.magenta}"

    crs:SplitToningShadowHue="${color_grading.shadows_hue}"
    crs:SplitToningShadowSaturation="${color_grading.shadows_saturation}"
    crs:SplitToningHighlightHue="${color_grading.highlights_hue}"
    crs:SplitToningHighlightSaturation="${color_grading.highlights_saturation}"
    crs:SplitToningBalance="${color_grading.balance}"

    crs:Sharpness="${detail.sharpening}"
    crs:LuminanceSmoothing="${detail.noise_reduction}"
    crs:ColorNoiseReduction="${detail.color_noise_reduction}"

    crs:VignetteAmount="${effects.vignette_amount}"
    crs:VignetteMidpoint="${effects.vignette_midpoint}"
    crs:GrainAmount="${effects.grain_amount}"
    crs:GrainSize="${effects.grain_size}"
    crs:GrainFrequency="${effects.grain_roughness}"

    crs:ShadowTint="${calibration.shadows_hue}"
    crs:RedHue="${calibration.red_hue}"
    crs:RedSaturation="${calibration.red_saturation}"
    crs:GreenHue="${calibration.green_hue}"
    crs:GreenSaturation="${calibration.green_saturation}"
    crs:BlueHue="${calibration.blue_hue}"
    crs:BlueSaturation="${calibration.blue_saturation}"
  />
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function downloadXMP(result: LightroomResult, presetName: string) {
  const xmp = generateXMP(result, presetName);
  const blob = new Blob([xmp], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(presetName)}.xmp`;
  a.click();
  URL.revokeObjectURL(url);
}