# NarcCheck AI — App Store Screenshots

Ready-to-upload screenshots at Apple's required resolutions for App Store Connect.

## 6.7" (iPhone 15 Pro Max, 14 Pro Max, 16 Pro Max)
`6.7/01_home.png` → **1290 × 2796** — Home / intake with transcript pre-filled
`6.7/02_scorecard.png` → **1290 × 2796** — Dual score gauges with verdict and traits
`6.7/03_history.png` → **1290 × 2796** — Populated history list with 3 saved scorecards
`6.7/04_paywall.png` → **1290 × 2796** — Paywall with plan selector

## 6.5" (iPhone 11 Pro Max, XS Max)
`6.5/01_home.png` → **1242 × 2688**
`6.5/02_scorecard.png` → **1242 × 2688**
`6.5/03_history.png` → **1242 × 2688**
`6.5/04_paywall.png` → **1242 × 2688**

## Upload order for App Store Connect
1. **Home** — sells the concept in the first frame
2. **Scorecard** — the product's wow moment
3. **History** — proves the app has depth
4. **Paywall** — sets pricing expectations before install

## Regenerate later
Run the same Playwright capture flow (see the tool call that produced iteration files under `/root/.emergent/automation_output/<timestamp>/`) after seeding a Pro session and history:

1. Insert a `users` row + a `user_sessions` row directly into Mongo.
2. Seed 3 history rows with contrasting `person_a_score` vs `person_b_score`.
3. Use `page.add_init_script` to preload `narc.session_token` and `narc.onboarded`.
4. Screenshot at CSS **430×932** (6.7") and **414×896** (6.5") — then Lanczos-resize with PIL cover-crop to the target sizes above.

## Notes
- Screenshots are captured against RC's test store, so prices show `$79.99 / $9.99`; the store screenshots you upload should be re-taken **after** you've configured your real IAPs in App Store Connect (`$60 / $8.99`) and pointed the RC dashboard at them, so the paywall shot matches submission pricing.
- Apple prefers no status bar or a clean unified status bar; you can composite a status bar overlay if desired, but Apple accepts screenshots as-is.
