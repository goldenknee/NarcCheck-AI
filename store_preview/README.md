# NarcCheck AI — App Store Preview Videos

Ready-to-upload 15-second App Preview videos at Apple's required resolutions.

## Files
- `preview_6.7_1290x2796.mp4` — **1290 × 2796**, portrait — iPhone 15/14/16 Pro Max (6.7")
- `preview_6.5_1242x2688.mp4` — **1242 × 2688**, portrait — iPhone 11 Pro Max / XS Max (6.5")

## Encoding (both files)
- Codec: **H.264 High profile, level 4.2**
- Pixel format: **yuv420p** (required by App Store Connect)
- Frame rate: **30 fps**
- Duration: **exactly 15.0 seconds** (App Store minimum)
- Audio: **none** (silent preview — App Store allows this)
- Faststart: yes (`+faststart`)

## Storyboard
1. **0.0 – 3.8s** — Home screen with the tagline "Analyse an argument. Uncover manipulation tactics." + the 3-mode segment (Paste / Screenshots / Voice)
2. **3.8 – 6.7s** — Transcript being typed live, ending with the red "Analyse Argument" CTA fully filled
3. **6.7 – 8.5s** — Cut to the Scorecard already loading (Analysing wait is edited out)
4. **8.5 – 13.2s** — Dual gauges animate up to their final scores (12 / 71) with verdict card and 4 trait pills
5. **13.2 – 15.0s** — Hold on the finished scorecard with Save + Share Card CTAs visible

## Upload steps (App Store Connect)
1. Publish and generate an iOS build.
2. In App Store Connect → Your App → **Media Manager**, upload the matching-size preview to the "iPhone 6.7" Display" and "iPhone 6.5" Display" slots.
3. Choose a "poster frame" — recommend the final scorecard frame (~14s in) so the preview thumbnail sells the product.

## Regenerate later
- `python3 /tmp/record_preview.py` — records the raw flow to `/tmp/preview_full.webm` and prints timings so the concat cut points can be updated.
- `bash /tmp/build_preview.sh` — concatenates the two segments and encodes both output MP4s.
- Requires: `ffmpeg`, Playwright + Chromium installed (both already provisioned in this workspace).

## Notes
- Video was captured against the RC Test Store. Re-record the paywall-visible section only after your real IAPs are live in App Store Connect (this specific preview never shows prices, so it's fine to submit as-is).
- Apple requires the preview to reflect the actual in-app experience; no third-party marketing elements added.
