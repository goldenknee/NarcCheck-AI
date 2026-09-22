# NarcCheck AI — Product Requirements

## Overview
NarcCheck AI is a mobile app (Expo / React Native, iOS + Android) that evaluates text-message arguments and determines narcissistic behavioral traits between two participants using AI. Users can paste a raw transcript, upload up to 6 screenshots, or record a voice note. The app returns per-person narcissism scores (0-100), key manipulative traits, notable quotes, a verdict, and a chronological breakdown.

## Tech stack
- Expo Router + React Native (strict dark mode)
- FastAPI + MongoDB backend (routes prefixed with `/api`)
- OpenAI GPT-5.4 (multimodal) + Whisper via Emergent Universal Key
- Emergent-managed RevenueCat for in-app subscriptions
- Auth: Apple Sign-In (iOS) + Emergent-managed Google Sign-In (optional)

## Screens
- `/` — Intake (Paste / Screenshots / Voice); quota / PRO badge; sign-in / settings icon; Streak card for Pro; sticky Analyse CTA
- `/scorecard` — Dual animated SVG gauges, verdict banner, trait pills, notable quotes, collapsible breakdown; Save + Share Card (view-shot + expo-sharing)
- `/history` — Saved analyses (scoped by user_id or X-Device-Id)
- `/paywall` — Annual $60 / Monthly $8.99 (Emergent-managed RevenueCat)
- `/sign-in` — Optional Apple + Google auth
- `/settings` — Account, Subscription (manage/upgrade), Sign Out, **Delete Account** (soft-delete), Legal (Privacy / Terms / Support), medical-advice disclaimer

## API (`/api`)
- `POST /analyze` — text OR image analysis
- `POST /transcribe` — whisper-1 audio transcription
- `POST/GET/GET-by-id/DELETE /history` — MongoDB-backed, scoped, soft-delete
- `POST /auth/apple` — Apple identity token verification → session token
- `POST /auth/session` — Emergent Google session_id exchange → session token
- `GET  /auth/me` — Bearer → current user (excludes soft-deleted users)
- `POST /auth/logout` — invalidates the session token
- `DELETE /auth/me` — soft-deletes the user, purges all sessions, soft-deletes all history

## Design
- Strict dark palette from `/app/design_guidelines.json`
- Tokens in `/app/frontend/src/theme.ts`
- Brand red `#DC2626`, amber `#F59E0B`, carbon `#09090B`
- App icon: red rounded square with black-stroked white "N"
