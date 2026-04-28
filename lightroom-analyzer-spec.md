# Lightroom Edit Analyzer — Product Specification

## Overview

A web application for photographers that uses AI vision to analyze an edited photo and reverse-engineer the Lightroom settings used to achieve its look. The user uploads any image and receives a complete, panel-by-panel breakdown of estimated Lightroom parameters they can replicate directly in Adobe Lightroom Classic or Lightroom CC.

---

## Goals

- Help photographers learn and replicate editing styles from reference images
- Save time when matching a specific look or aesthetic across a shoot
- Serve as an educational tool for understanding how edits translate visually

## Non-Goals

- This app does not perform actual pixel-level editing or RAW processing
- This app is not a replacement for Lightroom itself

---

## User Flow

```
1. User lands on the app
2. User selects a mode: "Analyze Photo" or "Edit Difference"
3. User uploads one or two photos (up to 50MB each)
4. EXIF metadata is extracted and displayed immediately
5. User clicks the action button
6. Loading skeleton shown while AI analyzes
7. AI analyzes the image(s) and returns structured Lightroom settings
8. Results displayed panel by panel, mirroring Lightroom's UI layout
9. User tweaks values with interactive sliders if needed
10. User saves to library and/or downloads as .xmp preset
```

---

## Modes

### Mode 1 — Analyze Photo
Upload a single edited photo. The AI reverse-engineers the Lightroom settings used to create the look.

### Mode 2 — Edit Difference
Upload an original (unedited) and an edited version of the same photo. The AI detects exactly what changed between the two and returns those changes as Lightroom settings.

---

## Features

### 1. Image Upload
- Drag-and-drop zone
- Click-to-browse file picker
- Accepts: JPG, PNG, WEBP, HEIC (HEIC support depends on browser)
- Max file size: **50MB** (auto-compressed to 10MB before API call)
- Image preview shown after selection
- Ability to swap/change the image after upload
- "Loaded from library" state when a preset is loaded without an image

### 2. EXIF Metadata Display
- Reads camera metadata directly from the uploaded file (client-side, no API needed)
- Displays: camera make + model, aperture, shutter speed, ISO, focal length, exposure bias, date
- Shown as badge pills between the upload zone and Analyze button
- Only visible when EXIF data is present (many web images have it stripped)

### 3. AI Analysis
- Sends image(s) to Claude vision model via Anthropic API (server-side, API key secure)
- Images over 10MB are auto-compressed before sending (max 2400px, JPEG 85%)
- Returns structured JSON with all Lightroom panel values
- Includes a natural-language style summary
- Includes a confidence level: `high`, `medium`, or `low`
- Loading skeleton shown during analysis

### 4. Results Display — Lightroom Panels

Results are organized to mirror Lightroom's panel order. Each panel is collapsible.

#### 4a. Light Panel
| Parameter   | Range        |
|-------------|--------------|
| Exposure    | -5.0 to +5.0 |
| Contrast    | -100 to +100 |
| Highlights  | -100 to +100 |
| Shadows     | -100 to +100 |
| Whites      | -100 to +100 |
| Blacks      | -100 to +100 |

#### 4b. Color Panel
| Parameter   | Range             |
|-------------|-------------------|
| Temperature | 2000 – 50000 K    |
| Tint        | -150 to +150      |
| Vibrance    | -100 to +100      |
| Saturation  | -100 to +100      |

#### 4c. HSL / Color
Three sub-tabs: **Hue**, **Saturation**, **Luminance**
Eight color channels each: Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
All values: -100 to +100

#### 4d. Color Grading
- Three color wheels: Shadows, Midtones, Highlights
- Each wheel: Hue (0–359°) + Saturation (0–100)
- Blending (0–100) and Balance (-100 to +100)
- Visual dot-on-wheel representation

#### 4e. Detail
| Parameter                 | Range    |
|---------------------------|----------|
| Sharpening                | 0 – 150  |
| Luminance Noise Reduction | 0 – 100  |
| Color Noise Reduction     | 0 – 100  |

#### 4f. Effects
| Parameter         | Range        |
|-------------------|--------------|
| Vignette Amount   | -100 to +100 |
| Vignette Midpoint | 0 – 100      |
| Grain Amount      | 0 – 100      |
| Grain Size        | 0 – 100      |
| Grain Roughness   | 0 – 100      |

#### 4g. Calibration
| Parameter        | Range        |
|------------------|--------------|
| Shadows Hue      | -100 to +100 |
| Red Hue          | -100 to +100 |
| Red Saturation   | -100 to +100 |
| Green Hue        | -100 to +100 |
| Green Saturation | -100 to +100 |
| Blue Hue         | -100 to +100 |
| Blue Saturation  | -100 to +100 |

### 5. Interactive Sliders
- Each parameter is draggable — click and drag left/right to adjust
- Modified sliders show terracotta thumb + ↺ reset icon next to value
- Small marker shows original AI value position on the track
- "You have unsaved slider changes" banner appears with Reset all button
- Reset all reverts every slider to the original AI values

### 6. Before/After Comparison
- Draggable split-view below the upload zone
- Left side: original uploaded photo
- Right side: CSS-approximated preview reflecting current slider values
- Handle draggable across full width via window-level mouse events
- Note: Whites and Blacks have no CSS equivalent — not reflected in preview

### 7. Export as .xmp Preset
- User names the preset in a textarea (auto-filled with style summary)
- One-click download of a `.xmp` file importable into Lightroom Classic and CC
- XMP uses tweaked slider values, not original AI values
- Preset name sanitized: XML-escaped, control chars removed, filename-safe
- Import instructions shown in the UI

### 8. Preset Library
- Save analyzed results with name, thumbnail, collection, and full result
- Persistent across sessions via localStorage
- Load a saved preset back into the results panel
- Delete presets with confirmation dialog

### 9. Preset Collections
- Organize presets into named collections (e.g. "Wedding", "Street")
- Default collection: "Uncategorized"
- Create new collections from the library drawer or the save dropdown
- Move presets between collections
- Delete collections (presets moved to Uncategorized)
- Collection dropdown in Save & Export updates in real time when new collections are created

### 10. Preset Search
- Real-time search by preset name or style summary
- Filter by collection via pill tabs
- Combined search + collection filter
- Clear search button (✕)

### 11. Dark Mode
- Toggle button (sun/moon SVG icons) in the top nav
- Theme persists via localStorage
- Defaults to OS preference if no saved preference
- Implemented via `ThemeProvider` wrapper + CSS variables on `.theme-root` / `.theme-root.dark`
- Smooth transition between themes

### 12. Loading Skeleton
- Shimmer placeholder panels shown while AI is analyzing
- Mirrors the layout of the actual results (header, save section, panels)
- Uses CSS `@keyframes shimmer` animation

### 13. Toast Notifications
- Non-blocking toasts for success/error/warn/info
- Used for key user feedback in analyze + batch flows (including rate-limit messages)

### 14. Rate Limiting (API)
- Per-IP sliding-window in-memory rate limiting for API routes
- Configured per route: `ANALYZE_LIMIT`, `DIFF_LIMIT`, `BATCH_LIMIT`, `CRITIQUE_LIMIT` (1h windows)
- When exceeded, API returns `429` with rate-limit headers (Remaining/Reset/Retry-After)

---

## Removed Features

| Feature | Reason |
|---|---|
| Tone Curve panel | Removed by user preference |
| Tone curve visual graph | Removed alongside tone curve panel |

---

## Backlog

| Feature | Priority | Notes |
|---|---|---|
| **Animate panel open/close** | Medium | Smooth height transition when collapsing sections |
| **Sticky results header** | Medium | Keep confidence badge + summary visible while scrolling |
| **Confidence per panel** | Medium | Show per-section confidence instead of one overall badge |
| **"Why this value?" tooltip** | Medium | Hover any slider for AI explanation of that setting |
| **Disclaimer banner** | Medium | Note that AI values are estimates, not exact |
| **Print/PDF summary** | Medium | One-page PDF of all settings for workshops/client handoffs |
| **Undo history for sliders** | Medium | Step backwards through slider changes |
| **CORS lockdown** | High | Restrict API to own domain for public deployment |
| **Share as link** | Low | Encode preset into URL to send to another photographer |
| **Multiple image comparison** | Low | Analyze several images and compare settings side by side |
| **Lightroom plugin** | Low | Adobe plugin SDK integration |
| **Batch analysis** | Low | Analyze a folder of images at once |
| **Mobile app** | Low | Native iOS/Android |

---

## Technical Architecture

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + CSS variables for theming
- **Fonts:** Google Fonts — Syne (display) + DM Mono (mono)
- **State:** React `useState` / `useCallback` / `useEffect` hooks
- **Theme:** `ThemeProvider` client component + custom `lr-theme-change` event

### AI Integration
- **Provider:** Anthropic API (`/v1/messages`)
- **Model:** `claude-sonnet-4-5`
- **API key:** Server-side only via Next.js API routes (never exposed to client)
- **Input:** Base64-encoded image(s) + system prompt
- **Output:** Structured JSON parsed server-side
- **Image compression:** Client-side canvas resize before API if > 10MB

### Storage
- **Presets:** `localStorage` under key `lr-analyzer-presets`
- **Collections:** `localStorage` under key `lr-analyzer-collections`
- **Theme:** `localStorage` under key `lr-theme`

### Data Flow
```
User uploads image (up to 50MB)
  → EXIF extracted from original binary file
  → Image compressed to ≤10MB if needed
  → base64 + MIME stored in React state
  → On "Analyze": POST to /api/analyze (Next.js route)
  → Server validates payload size, calls Anthropic API
  → JSON parsed + sanitized (+ signs stripped)
  → UI renders skeleton → then full results
  → User tweaks sliders → editedResult state updates
  → Export uses editedResult values
```

### Security
- API key never exposed to client
- Server-side payload size validation (14MB base64 limit)
- XMP output sanitized (XML escaping, control char removal, filename sanitization)
- File type validation client + server side
- Rate limiting on AI-backed API routes to reduce abuse (best-effort in-memory, per-isolate)

---

## Design System

### Light Theme
| Token | Value |
|---|---|
| `--bg` | `#f5f4f2` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#fafaf9` |
| `--border` | `#e8e5e0` |
| `--text-1` | `#1a1a1a` |
| `--text-3` | `#aaaaaa` |
| `--accent` | `#c07040` |

### Dark Theme
| Token | Value |
|---|---|
| `--bg` | `#0e0e0e` |
| `--surface` | `#161616` |
| `--surface-2` | `#1e1e1e` |
| `--border` | `#2a2a2a` |
| `--text-1` | `#f0ece5` |
| `--text-3` | `#666666` |
| `--accent` | `#e08c5a` |

Display font: **Syne 800** · Mono font: **DM Mono 300–500**

---

## Testing

### Unit Tests (Vitest)
- `xmp.test.ts` — XMP generation, XML sanitization, filename sanitization
- `presetStorage.test.ts` — localStorage CRUD, collections, migration
- `setIn.test.ts` — deep value updates, immutability
- `jsonParsing.test.ts` — JSON cleanup, file size validation
- `exif.test.ts` — formatting functions, binary EXIF parsing, edge cases
- `rateLimit.test.ts` — IP detection + sliding window behavior + per-IP isolation + config sanity checks

### Component Tests (Vitest + React Testing Library)
- `Slider.test.tsx` — rendering, reset button, modified state, drag
- `Section.test.tsx` — collapse/expand toggle
- `PresetLibrary.test.tsx` — filtering logic, search, collection tabs, interactions

### E2E Tests (Playwright)
- `app.spec.ts` — full analyze flow, library save/load, Edit Difference tab
- Note: currently blocked by corporate SSL restrictions on Chromium download

---

## Known Limitations

- AI estimates are approximations — local adjustments (masks, brushes, radial filters) cannot be detected
- Whites and Blacks adjustments have no CSS equivalent — not reflected in Before/After preview
- HEIC support depends on browser compatibility
- EXIF data is often stripped from images downloaded from social media
- Confidence level is self-reported by the model and may not always be accurate
- Before/After preview uses CSS filter approximations, not actual Lightroom rendering
- E2E tests cannot run on corporate networks that block Playwright browser downloads
