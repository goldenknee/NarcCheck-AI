# NarcCheck AI — Product Requirements

## Overview
NarcCheck AI is a mobile app (Expo / React Native, iOS + Android) that evaluates text-message arguments and determines narcissistic behavioral traits between two participants using AI. Users can paste a raw transcript, upload up to 6 screenshots, or record a voice note. The app returns per-person narcissism scores (0-100), key manipulative traits, notable quotes, a verdict, and a chronological breakdown.

## Tech stack
- Expo Router + React Native (strict dark mode)
- FastAPI + MongoDB backend (routes prefixed with `/api`)
- OpenAI GPT-5.4 (multimodal) + Whisper via Emergent Universal Key
- Emergent-managed RevenueCat for in-app subscriptions
- Auth: Apple Sign-In (iOS) + Emergent-managed Google Sign-In. Optional — app is fully usable anonymously.

## Screens
- `/` — Intake (3-tab: Paste / Screenshots / Voice; participant names; quota / PRO badge; sign-in / sign-out button; Streak card for Pro; sticky Analyse CTA)
- `/scorecard` — Dual animated SVG gauges, verdict banner, trait pills, notable quotes, collapsible breakdown; Save + Share (Trait Radar Export via react-native-view-shot)
- `/history` — Saved analyses (scoped by user_id when signed in, by device_id when anonymous)
- `/paywall` — Annual $60 / Monthly $8.99 subscription modal (Emergent-managed RevenueCat)
- `/sign-in` — Optional Apple + Google auth modal

## API (`/api`)
- `POST /analyze` — text OR image analysis
- `POST /transcribe` — whisper-1 audio transcription
- `POST/GET/GET-by-id/DELETE /history` — MongoDB-backed, scoped by user_id or X-Device-Id
- `POST /auth/apple` — Apple identity token verification, issues 7-day session token
- `POST /auth/session` — Emergent Google session_id exchange, issues 7-day session token
- `GET  /auth/me` — Bearer session token → current user
- `POST /auth/logout` — invalidates the session token

## Auth model
- Bearer session tokens stored in `expo-secure-store` on native, `localStorage` on web
- History migration: on first sign-in the server bulk-updates rows where `device_id == caller_device_id` to set `user_id` and unset `device_id`
- Anonymous users always work — no forced sign-in anywhere in the flow

## Subscription model
- 3 free analyses total tracked on-device with AsyncStorage; 4th tap opens paywall
- `pro` entitlement unlocks unlimited analyses + the No-Narc Streak widget
- Save + Share + History remain free

## Design
- Strict dark palette from `/app/design_guidelines.json` (carbon `#09090B`, Signal Red `#DC2626`, Amber `#F59E0B`)
- Tokens live in `/app/frontend/src/theme.ts`
- Haptics on primary CTA, gauge settle, collapsible toggle, purchase success, streak freeze
