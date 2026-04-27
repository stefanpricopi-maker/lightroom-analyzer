# LR Analyzer Lightroom Classic Plugin

This folder contains a Lightroom Classic plugin that connects to the deployed **LR Analyzer** Next.js app:

- **API base URL**: `https://lightroom-analyzer.vercel.app`

## Folder layout

Lightroom requires the plugin folder to end with `.lrplugin`.

```
lr-analyzer-plugin/
└── lr-analyzer.lrplugin/
    ├── Info.lua
    ├── AnalyzePhoto.lua
    └── AnalyzeBatch.lua
```

## Install in Lightroom Classic

1. In Finder, locate this folder:
   - `lr-analyzer-plugin/lr-analyzer.lrplugin`
2. Open **Lightroom Classic**
3. Go to **File → Plug-in Manager**
4. Click **Add**
5. Select the folder **`lr-analyzer.lrplugin`**
6. Ensure the plugin is **Enabled**

## Use the plugin

### Analyze Selected Photo

1. Select a photo in the Library (or Filmstrip)
2. Go to **File → Plug-in Extras → Analyze Selected Photo**
3. The plugin:
   - Exports the selected photo to a temp JPEG (max 2400px, quality 85)
   - Uploads it as multipart/form-data to `POST /api/analyze`
   - Applies the returned develop settings to the photo
   - Shows a success dialog with `style_summary`

### Batch Analyze Selected Photos

1. Select multiple photos
2. Go to **File → Plug-in Extras → Batch Analyze Selected Photos**
3. The plugin:
   - Exports each photo to a temp JPEG
   - Uploads it as multipart/form-data to `POST /api/batch-analyze` with an `exifHint`
   - Applies **Light panel values only** (Exposure/Contrast/Highlights/Shadows/Whites/Blacks)
   - Shows progress: “Processing photo X of Y”
   - Shows a final summary with number processed

## Requirements

- Lightroom Classic with the Lightroom SDK (plugin support)
- Your LR Analyzer deployment must be reachable:
  - `https://lightroom-analyzer.vercel.app`
- The Vercel project must have `ANTHROPIC_API_KEY` set for Production (for analyze endpoints to work)

## Troubleshooting

- **“API request failed” / unreachable**
  - Check you can open `https://lightroom-analyzer.vercel.app` in a browser.
  - Ensure the endpoint `/api/analyze` is working from the web app.
- **No menu items**
  - Verify the folder is named exactly `lr-analyzer.lrplugin`
  - Re-add it in **Plug-in Manager**

