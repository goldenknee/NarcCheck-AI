# Narc — Product Requirements

## Overview
Narc is a mobile app (Expo / React Native, iOS + Android) that evaluates text-message arguments and determines narcissistic behavioral traits between two participants using AI. Users can either paste a raw transcript or upload up to 6 screenshots; the multimodal LLM analyses the conversation and returns per-person narcissism scores (0-100), key manipulative traits detected, notable quotes, a verdict, and a chronological breakdown.

## Tech stack
- Expo Router + React Native (strict dark mode)
- FastAPI + MongoDB backend (routes prefixed with `/api`)
- `emergentintegrations` LlmChat with OpenAI `gpt-5.4` (multimodal), via Emergent Universal Key

## Screens
- `/` — Intake (mode switch: Paste / Upload; participant name inputs; sticky Analyse CTA)
- `/scorecard` — Dual animated SVG gauges (Person A vs Person B), verdict banner, per-person trait pill callouts, notable quotes, collapsible chronological breakdown; Save + Share actions
- `/history` — List of saved analyses with pull-to-refresh and swipe/delete; tapping a row opens `/scorecard?id=<id>` in read-only mode

## API (all under `/api`)
- `POST /analyze` — `{ mode: "text"|"image", text?, images_base64?[], person_a_name?, person_b_name? }` → `AnalysisResult`
- `POST /history` — save analysis
- `GET /history` — list all
- `GET /history/{id}` — fetch one
- `DELETE /history/{id}` — remove one

## Design
- Strict dark palette from `/app/design_guidelines.json` (carbon `#09090B` base, Signal Red `#DC2626` brand, Amber `#F59E0B` secondary). Tokens live in `/app/frontend/src/theme.ts`.
- Haptic feedback: medium on primary CTA, heavy on gauge score-settle, light on collapsible toggle.
- Ionicons via `@react-native-vector-icons/ionicons`.
