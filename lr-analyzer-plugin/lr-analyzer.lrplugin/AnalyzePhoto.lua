local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrTasks = import "LrTasks"
local LrFunctionContext = import "LrFunctionContext"
local LrHttp = import "LrHttp"
local LrExportSession = import "LrExportSession"
local LrPathUtils = import "LrPathUtils"
local LrProgressScope = import "LrProgressScope"

local JSON = require "JSON"

local VERCEL_BASE_URL = "https://lightroom-analyzer.vercel.app"

local function clampNumber(v, minV, maxV)
  if v == nil then return nil end
  if type(v) ~= "number" then return nil end
  if v < minV then return minV end
  if v > maxV then return maxV end
  return v
end

local function exportPhotoToTempJpeg(photo)
  local tempDir = LrPathUtils.getStandardFilePath("temp")
  -- Lightroom 5.x doesn't expose LrTasks.getCurrentTime(); os.time() is sufficient for unique temp names.
  local outPath = LrPathUtils.child(tempDir, "lr-analyzer-export-" .. tostring(os.time()) .. ".jpg")

  local session = LrExportSession({
    photosToExport = { photo },
    exportSettings = {
      LR_export_destinationPathPrefix = tempDir,
      LR_export_useSubfolder = false,
      LR_export_destinationType = "specificFolder",
      LR_format = "JPEG",
      LR_jpeg_quality = 0.85,
      LR_size_doConstrain = true,
      LR_size_maxHeight = 2400,
      LR_size_maxWidth = 2400,
      LR_reimportExportedPhoto = false,
      LR_collisionHandling = "overwrite",
      LR_export_colorSpace = "sRGB",
      LR_export_bitDepth = 8,
      LR_export_postProcessing = "doNothing",
      LR_export_fileNaming = "customName",
      LR_tokens = "lr-analyzer-export",
    },
  })

  local n = 0
  for _, rendition in session:renditions({ stopIfCanceled = true }) do
    n = n + 1
    local success, pathOrMessage = rendition:waitForRender()
    if success then
      -- Lightroom chooses output name; prefer the actual rendered path.
      return pathOrMessage
    else
      return nil, pathOrMessage or "Export failed."
    end
  end

  -- Fallback to our guessed path (should not normally happen).
  if n == 0 then
    return nil, "No rendition produced."
  end
  return outPath
end

local function postAnalyzeFile(jpegPath, mimeType, progressScope)
  local url = VERCEL_BASE_URL .. "/api/analyze"

  progressScope:setCaption("Contacting LR Analyzer…")

  -- Lightroom 5.x: LrHttp yields internally, so wrapping it in plain pcall triggers:
  -- "Yielding is not allowed within a C or metamethod call".
  local ok, resBodyOrErr = LrTasks.pcall(function()
    return LrHttp.postMultipart(url, {
      {
        name = "image",
        filePath = jpegPath,
        fileName = "photo.jpg",
        contentType = mimeType,
      },
      { name = "mimeType", value = mimeType },
    }, {})
  end)

  if not ok then
    return nil, "API request failed: " .. tostring(resBodyOrErr)
  end

  local resBody = resBodyOrErr
  if not resBody or resBody == "" then
    return nil, "Empty response from API."
  end

  local decoded
  local decodeOk, decodeErr = pcall(function()
    decoded = JSON.decode(resBody)
  end)
  if not decodeOk then
    return nil, "Failed to parse API JSON: " .. tostring(decodeErr)
  end

  return decoded
end

local function buildDevelopSettings(result)
  -- Lightroom develop setting keys vary by process version.
  -- These keys target Process Version 2012 (Lightroom Classic modern defaults).
  local settings = {}

  if result.light then
    settings.Exposure2012 = clampNumber(result.light.exposure, -5, 5)
    settings.Contrast2012 = clampNumber(result.light.contrast, -100, 100)
    settings.Highlights2012 = clampNumber(result.light.highlights, -100, 100)
    settings.Shadows2012 = clampNumber(result.light.shadows, -100, 100)
    settings.Whites2012 = clampNumber(result.light.whites, -100, 100)
    settings.Blacks2012 = clampNumber(result.light.blacks, -100, 100)
  end

  if result.color then
    settings.Temperature = clampNumber(result.color.temperature, 2000, 50000)
    settings.Tint = clampNumber(result.color.tint, -150, 150)
    settings.Vibrance = clampNumber(result.color.vibrance, -100, 100)
    settings.Saturation = clampNumber(result.color.saturation, -100, 100)
  end

  if result.effects then
    settings.VignetteAmount = clampNumber(result.effects.vignette_amount, -100, 100)
    settings.GrainAmount = clampNumber(result.effects.grain_amount, 0, 100)
  end

  if result.calibration then
    settings.RedPrimaryHue = clampNumber(result.calibration.red_hue, -100, 100)
    settings.RedPrimarySaturation = clampNumber(result.calibration.red_saturation, -100, 100)
    settings.GreenPrimaryHue = clampNumber(result.calibration.green_hue, -100, 100)
    settings.GreenPrimarySaturation = clampNumber(result.calibration.green_saturation, -100, 100)
    settings.BluePrimaryHue = clampNumber(result.calibration.blue_hue, -100, 100)
    settings.BluePrimarySaturation = clampNumber(result.calibration.blue_saturation, -100, 100)
  end

  -- HSL (Hue/Sat/Lum) keys:
  -- HueAdjustmentRed, SaturationAdjustmentRed, LuminanceAdjustmentRed, etc.
  local hsl = result.hsl or {}
  local hue = hsl.hue or {}
  local sat = hsl.saturation or {}
  local lum = hsl.luminance or {}

  local channels = {
    { key = "Red", field = "red" },
    { key = "Orange", field = "orange" },
    { key = "Yellow", field = "yellow" },
    { key = "Green", field = "green" },
    { key = "Aqua", field = "aqua" },
    { key = "Blue", field = "blue" },
    { key = "Purple", field = "purple" },
    { key = "Magenta", field = "magenta" },
  }

  for _, ch in ipairs(channels) do
    settings["HueAdjustment" .. ch.key] = clampNumber(hue[ch.field], -100, 100)
    settings["SaturationAdjustment" .. ch.key] = clampNumber(sat[ch.field], -100, 100)
    settings["LuminanceAdjustment" .. ch.key] = clampNumber(lum[ch.field], -100, 100)
  end

  return settings
end

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("LR Analyzer: Analyze Selected Photo", function(context)
    local catalog = LrApplication.activeCatalog()
    local targetPhoto = catalog:getTargetPhoto()

    if not targetPhoto then
      LrDialogs.message("LR Analyzer", "No photo selected.", "info")
      return
    end

    local progress = LrProgressScope({
      title = "LR Analyzer",
      caption = "Preparing export…",
    })
    progress:setCancelable(true)
    context:addCleanupHandler(function()
      progress:done()
    end)

    local exportPath, exportErr = exportPhotoToTempJpeg(targetPhoto)
    if not exportPath then
      LrDialogs.message("LR Analyzer", "Export failed: " .. tostring(exportErr), "critical")
      return
    end

    if progress:isCanceled() then return end
    progress:setPortionComplete(0.2)
    progress:setPortionComplete(0.35)
    local result, apiErr = postAnalyzeFile(exportPath, "image/jpeg", progress)
    if not result then
      LrDialogs.message("LR Analyzer", tostring(apiErr), "critical")
      return
    end

    if progress:isCanceled() then return end
    progress:setPortionComplete(0.8)
    progress:setCaption("Applying settings…")

    -- Lightroom 5.x: write access may yield; use LrTasks.pcall (yield-safe).
    local ok, applyErr = LrTasks.pcall(function()
      local preset = LrApplication.addDevelopPresetForPlugin(_PLUGIN, "LR Analyzer (temp)", buildDevelopSettings(result))
      local status = catalog:withWriteAccessDo("LR Analyzer: Apply Develop Settings", function()
        targetPhoto:applyDevelopPreset(preset, _PLUGIN)
      end, { timeout = 30 })
      if status == "aborted" then
        error("Write access timed out while applying develop settings.")
      end
    end)
    if not ok then
      LrDialogs.message("LR Analyzer", "Failed to apply settings: " .. tostring(applyErr), "critical")
      return
    end

    progress:setPortionComplete(1)
    progress:setCaption("Done")

    local summary = (type(result) == "table" and result.style_summary) and tostring(result.style_summary) or "Analysis complete."
    LrDialogs.message("LR Analyzer", "Success!\n\n" .. summary, "info")
  end)
end)

