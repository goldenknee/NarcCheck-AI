# NarcCheck AI — Product Requirements

## Overview
NarcCheck AI is a mobile app (Expo / React Native, iOS + Android) that evaluates text-message arguments and determines narcissistic behavioral traits between two participants using AI. Users can paste a raw transcript, upload up to 6 screenshots, or record a voice note; the multimodal LLM / Whisper analyses the conversation and returns per-person narcissism scores (0-100), key manipulative traits, notable quotes, a verdict, and a chronological breakdown.

## Tech stack
- Expo Router + React Native (strict dark mode)
- FastAPI + MongoDB backend (routes prefixed with `/api`)
- OpenAI GPT-5.4 (multimodal) + Whisper via Emergent Universal Key
- Emergent-managed RevenueCat for in-app subscriptions

## Screens
- `/` — Intake (3-tab: Paste / Screenshots / Voice; participant name inputs; quota or PRO badge; sticky Analyse CTA)
- `/scorecard` — Dual animated SVG gauges (A vs B), verdict banner, per-person trait pill callouts, notable quotes, collapsible chronological breakdown; Save + Share
- `/history` — Saved analyses with pull-to-refresh and delete; tapping a row opens read-only scorecard
- `/paywall` — Full-screen modal offering Annual ($60) and Monthly ($8.99) subscriptions with benefits, plan selector, sticky purchase CTA, Restore Purchases, dev-only simulate confirmation

## API (`/api`)
- `POST /analyze` — text OR image analysis, strict JSON schema output
- `POST /transcribe` — whisper-1 audio transcription (m4a/wav/mp3/webm, up to 25 MB)
- `POST/GET/GET-by-id/DELETE /history` — MongoDB-backed history

## Subscription model
- 3 free analyses total (tracked on-device with AsyncStorage); 4th tap opens paywall
- `pro` entitlement unlocks unlimited analyses
- Save + Share + History remain free
- Prices: $8.99/mo, $60/yr (RC Test Store shows default prices in Expo Go / web preview; real App Store / Play Store shows configured prices)

## Design
- Strict dark palette from `/app/design_guidelines.json` (carbon `#09090B`, Signal Red `#DC2626`, Amber `#F59E0B`). Tokens in `/app/frontend/src/theme.ts`.
- Haptics: medium on primary CTA, heavy on gauge settle, light on collapsible toggle, success on subscription purchase.
