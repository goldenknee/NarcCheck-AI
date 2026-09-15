# RevenueCat — integrated (2026-02-14)
This file serves as a memory to interact with the user's RevenueCat account via integration proxy at any later point.

## Identifiers (from /setup response — copy verbatim)
- rc_project_id: projde3abc13
- apple_app_id: appdf693ecedf
- play_app_id: app4557d50419
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prodd37e8a3f81   ($8.99 / P1M, trial: none)
  - $rc_annual  -> prodefa1d20c31   ($60.00 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/projde3abc13

## Check for project_state in revenuecat status api response. if the project_state is less then project_created, re-fetch RevenueCat playbook via the integration expert tool.
Status check:
   `curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/857ded5a-9c4e-4972-a057-1eb95bb7b0aa/status"`
   → `{"connection_state":"connected","project_state":"...","rc_project_id":"..."}`

## Later updates to user's products (integration proxy apis ONLY — NEVER call the RevenueCat REST API)
- Change price/duration/trial OR add a package (upsert):
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/857ded5a-9c4e-4972-a057-1eb95bb7b0aa/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"USD",
         "period":"P1M","trial":"P1W",
         "prices":[{"amount_micros":14990000,"currency":"USD"}]}]}
  (amount_micros = price × 1,000,000; omit "trial" for none)
- Remove a package:
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/857ded5a-9c4e-4972-a057-1eb95bb7b0aa/products/%24rc_monthly
  ($ -> %24)
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## Taking in-app purchases LIVE — user steps only (Test Store already works in Expo Go / web preview)
- Upload App Store / Play Store credentials to the RevenueCat dashboard
- Configure payment profiles in App Store Connect and Play Console
- Create matching in-app purchase products with SAME product IDs
- Test with TestFlight and Play Console internal testing before submission

Full FAQ available in Emergent's payments panel.
