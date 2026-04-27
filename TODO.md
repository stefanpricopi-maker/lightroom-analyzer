# Lightroom Edit Analyzer — TODO

## ✅ Completed

### Core
- [x] Next.js 15 project setup with TypeScript + Tailwind
- [x] Secure server-side Anthropic API route (`/api/analyze`)
- [x] Image upload — drag & drop + click to browse
- [x] Max 50MB upload with auto-compression to 10MB before API
- [x] Image preview + change photo
- [x] AI analysis returning structured Lightroom JSON
- [x] Style summary + confidence badge
- [x] All Lightroom panels: Light, Color, HSL, Color Grading, Detail, Effects, Calibration
- [x] Collapsible panel sections
- [x] Color-coded sliders (positive/negative)

### Features
- [x] Export as `.xmp` preset (download)
- [x] Before/After draggable split comparison (updates with slider changes)
- [x] Edit Difference mode (two-image comparison via `/api/diff`)
- [x] Interactive sliders — drag to tweak values before export
- [x] Reset to AI values — banner + button to revert all sliders
- [x] Preset Library (save, load, delete)
- [x] Preset Collections (create, delete, move presets)
- [x] Preset Search (real-time filter by name + style summary)
- [x] "Loaded from library" state in upload zone
- [x] EXIF metadata display (aperture, shutter, ISO, focal length, camera, date)
- [x] Dark mode toggle (persists via localStorage, defaults to OS preference)
- [x] Loading skeleton (shimmer placeholders during AI analysis)

### Security
- [x] API key server-side only (never exposed to client)
- [x] File size validation — client (50MB) + server (14MB base64)
- [x] File type validation (images only)
- [x] XMP output sanitized (XML escaping, control char removal, filename-safe)
- [x] Server-side payload size guard on both `/api/analyze` and `/api/diff`

### UI / Design
- [x] Light minimal theme with dark mode support
- [x] CSS variable design system (`--bg`, `--surface`, `--accent`, etc.)
- [x] ThemeProvider + custom event for instant theme switching
- [x] Sticky top nav with theme toggle + Library button
- [x] Two-tab layout: Analyze Photo / Edit Difference
- [x] Responsive two-column layout
- [x] Preset Library slide-in drawer
- [x] Full-width hero title + description

### Testing
- [x] Vitest + React Testing Library setup
- [x] Unit tests: XMP generation + sanitization (14 tests)
- [x] Unit tests: Preset storage CRUD + collections (18 tests)
- [x] Unit tests: setIn deep update utility (5 tests)
- [x] Unit tests: JSON parsing + file size validation (11 tests)
- [x] Unit tests: EXIF reader — formatting functions + binary parsing (40 tests)
- [x] Component tests: Slider (12 tests)
- [x] Component tests: Section collapse/expand (4 tests)
- [x] Component tests: PresetLibrary search + collection filtering (25 tests)
- [x] Playwright E2E config (blocked by corporate network — pending)

---

## 📋 Backlog

### Polish
- [ ] **Animate panel open/close** — smooth height transition when collapsing sections
- [ ] **Sticky results header** — keep confidence badge + summary visible while scrolling panels

### Features
- [ ] **Confidence per panel** — per-section confidence instead of one overall badge
- [ ] **"Why this value?" tooltip** — hover any slider for AI explanation
- [ ] **Disclaimer banner** — note that AI values are estimates
- [ ] **Print/PDF summary** — one-page PDF of all settings for workshops/handoffs
- [ ] **Undo history for sliders** — step backwards through slider changes

### Security (required before public deployment)
- [ ] **Rate limiting** — protect `/api/analyze` and `/api/diff` from abuse
- [ ] **CORS lockdown** — restrict API calls to own domain

### Low Priority
- [ ] **Share as link** — encode preset into a shareable URL
- [ ] **Multiple image comparison** — settings side-by-side
- [ ] **Lightroom plugin** — Adobe plugin SDK
- [ ] **Batch analysis** — analyze a folder at once
- [ ] **Mobile app** — native iOS/Android

### Removed
- [x] ~~Tone Curve panel~~ — removed by user preference
- [x] ~~Tone curve visual graph~~ — removed alongside tone curve panel
- [x] ~~Copy value to clipboard~~ — XMP export covers the use case better

---

## 🐛 Known Issues / Fixed

- [x] Hydration mismatch from browser extensions → `suppressHydrationWarning`
- [x] `+25` invalid JSON from AI → strip leading `+` signs before parsing
- [x] Before/After image misalignment → `clip-path` approach on single image
- [x] Before/After handle losing focus on fast drag → window-level mouse events
- [x] Preset Library drawer clipping behind nav → inline styles + z-index fix
- [x] New collections not appearing in save dropdown → polling + `onClose` callback
- [x] Blurry image when loading preset → clear image, show "loaded from library" state
- [x] Model `claude-sonnet-4-20250514` not found → updated to `claude-sonnet-4-5`
- [x] Dark mode toggle not working → `ThemeProvider` not wired into `layout.tsx`
- [x] Moon emoji rendering as yellow figure → replaced with SVG icons
- [x] Slider reset button showing on read-only sliders → `isModified` requires `onChange`
- [x] Section.test.tsx contained old Slider tests → replaced with correct Section tests
- [x] Multiple ✕ buttons in PresetLibrary causing test ambiguity → `data-testid="clear-search"`
- [x] EXIF formatting functions not testable → exported from `exif.ts`
