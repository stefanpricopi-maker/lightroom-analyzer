# Lightroom Edit Analyzer

A Next.js app for photographers that uses AI vision to analyze an edited photo and reverse-engineer the Lightroom settings used to achieve its look.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your API key

Copy the example env file and add your Anthropic API key:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and replace `your_api_key_here` with your key from [console.anthropic.com](https://console.anthropic.com).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
lightroom-analyzer/
├── app/
│   ├── api/analyze/route.ts        # Server-side Anthropic API call
│   ├── components/
│   │   ├── AnalyzerPage.tsx        # Main page client component
│   │   ├── ui/
│   │   │   ├── Slider.tsx          # Reusable slider component
│   │   │   ├── Section.tsx         # Collapsible panel section
│   │   │   └── ColorGradingWheel.tsx
│   │   └── panels/
│   │       └── Panels.tsx          # All 8 Lightroom panels
│   ├── lib/
│   │   ├── types.ts                # TypeScript interfaces
│   │   └── prompt.ts               # Anthropic system prompt
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── .env.local.example
├── tailwind.config.ts
└── next.config.ts
```

## Deploying to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add `ANTHROPIC_API_KEY` as an environment variable in the Vercel dashboard
4. Deploy — done!

## Lightroom Panels Covered

- **Light** — Exposure, Contrast, Highlights, Shadows, Whites, Blacks
- **Color** — Temperature, Tint, Vibrance, Saturation
- **Tone Curve** — Highlights, Lights, Darks, Shadows + curve description
- **HSL / Color** — All 8 channels × Hue, Saturation, Luminance
- **Color Grading** — Shadows, Midtones, Highlights wheels + Blending & Balance
- **Detail** — Sharpening, Noise Reduction, Color Noise Reduction
- **Effects** — Vignette & Film Grain
- **Calibration** — Shadow, Red, Green, Blue channel adjustments
