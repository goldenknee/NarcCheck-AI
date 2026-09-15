# NarcCheck AI — Auth testing notes

## Providers
- Apple Sign-In (iOS only, real device required for full E2E)
- Emergent-managed Google OAuth (works in Expo Go, Expo Web, iOS and Android builds)

## No app-managed passwords
Both providers are token-based. There are no app-managed passwords to store.

## Backend routes (all under `/api`)
- `POST /api/auth/apple` — body `{ identity_token, full_name?, email?, device_id? }`; verifies against Apple JWKS (issuer=`https://appleid.apple.com`, audience must be one of `APPLE_AUDIENCES` env var: `com.emergent.narcanalyzer.cslz18` for store builds, `host.exp.Exponent` for Expo Go). Issues `{ session_token, user }`.
- `POST /api/auth/session` — body `{ session_id, device_id? }`; exchanges the one-time Emergent `session_id` with `demobackend.emergentagent.com` and issues `{ session_token, user }`. Never accepts a `session_token` here.
- `GET /api/auth/me` — Bearer `{session_token}`; returns the current `User` or 401.
- `POST /api/auth/logout` — Bearer; invalidates the session token.

## Seeded test session
For automated backend tests, insert a row directly into the `user_sessions` and `users` collections and hit `/api/auth/me` with `Authorization: Bearer <token>`.

## History scoping
- Authenticated caller: `Authorization: Bearer <token>` → history scoped by `user_id`
- Anonymous caller: `X-Device-Id: <device_id>` → history scoped by `device_id`
- On first sign-in, all rows matching `device_id` are re-keyed to the user's `user_id` (device_id is unset).
