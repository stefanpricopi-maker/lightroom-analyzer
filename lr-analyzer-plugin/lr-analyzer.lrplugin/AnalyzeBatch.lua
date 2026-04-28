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
    },
  })

  for _, rendition in session:renditions({ stopIfCanceled = true }) do
    local success, pathOrMessage = rendition:waitForRender()
    if success then
      return pathOrMessage
    else
      return nil, pathOrMessage or "Export failed."
    end
  end

  return nil, "No rendition produced."
end

local function buildExifHint(photo)
  -- EXIF values vary by camera/file. We keep this robust and best-effort.
  local function safeGet(key)
    local ok, v = pcall(function() return photo:getRawMetadata(key) end)
    if ok then return v end
    return nil
  end

  local iso = safeGet("isoSpeedRating") or safeGet("isoSpeedRatings") or safeGet("iso") or "?"
  local aperture = safeGet("aperture") or safeGet("lensAperture") or "?"
  local shutter = safeGet("shutterSpeed") or safeGet("shutterSpeedValue") or "?"

  return string.format("ISO: %s, Aperture: %s, Shutter: %s", tostring(iso), tostring(aperture), tostring(shutter))
end

local function postBatchAnalyzeFile(jpegPath, mimeType, exifHint)
  local url = VERCEL_BASE_URL .. "/api/batch-analyze"

  local ok, resBodyOrErr = pcall(function()
    return LrHttp.postMultipart(url, {
      {
        name = "image",
        filePath = jpegPath,
        fileName = "photo.jpg",
        contentType = mimeType,
      },
      { name = "mimeType", value = mimeType },
      { name = "exifHint", value = exifHint },
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

local function applyLightOnly(photo, payload)
  local settings = {
    Exposure2012 = clampNumber(payload.exposure, -5, 5),
    Contrast2012 = clampNumber(payload.contrast, -100, 100),
    Highlights2012 = clampNumber(payload.highlights, -100, 100),
    Shadows2012 = clampNumber(payload.shadows, -100, 100),
    Whites2012 = clampNumber(payload.whites, -100, 100),
    Blacks2012 = clampNumber(payload.blacks, -100, 100),
  }

  local catalog = LrApplication.activeCatalog()
  catalog:withWriteAccessDo("LR Analyzer: Apply Light (Batch)", function()
    if photo.applyDevelopSettings then
      photo:applyDevelopSettings(settings)
    else
      for k, v in pairs(settings) do
        if v ~= nil then
          photo:setRawMetadata(k, v)
        end
      end
    end
  end)
end

LrTasks.startAsyncTask(function()
  LrFunctionContext.callWithContext("LR Analyzer: Batch Analyze Selected Photos", function(context)
    local catalog = LrApplication.activeCatalog()
    local photos = catalog:getTargetPhotos()

    if not photos or #photos == 0 then
      LrDialogs.message("LR Analyzer", "No photos selected.", "info")
      return
    end

    local progress = LrProgressScope({
      title = "LR Analyzer",
      caption = "Starting batch…",
    })
    progress:setCancelable(true)
    context:addCleanupHandler(function()
      progress:done()
    end)

    local successCount = 0
    local total = #photos

    for i, photo in ipairs(photos) do
      if progress:isCanceled() then break end
      progress:setCaption(string.format("Processing photo %d of %d", i, total))
      progress:setPortionComplete((i - 1) / total)

      local exportPath, exportErr = exportPhotoToTempJpeg(photo)
      if not exportPath then
        -- Skip with a warning, continue.
        LrDialogs.message("LR Analyzer", "Export failed for photo " .. tostring(i) .. ": " .. tostring(exportErr), "warning")
        goto continue
      end

      local exifHint = buildExifHint(photo)

      local payload, apiErr = postBatchAnalyzeFile(exportPath, "image/jpeg", exifHint)
      if not payload then
        LrDialogs.message("LR Analyzer", "API error for photo " .. tostring(i) .. ": " .. tostring(apiErr), "warning")
        goto continue
      end

      local ok, applyErr = pcall(function()
        applyLightOnly(photo, payload)
      end)
      if not ok then
        LrDialogs.message("LR Analyzer", "Apply failed for photo " .. tostring(i) .. ": " .. tostring(applyErr), "warning")
        goto continue
      end

      successCount = successCount + 1

      ::continue::
      LrTasks.yield()
    end

    progress:setPortionComplete(1)
    LrDialogs.message("LR Analyzer", string.format("%d photos processed successfully.", successCount), "info")
  end)
end)

