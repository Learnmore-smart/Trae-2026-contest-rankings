# lib/trae/dataconnect.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Initializes Firebase Admin for Firebase Data Connect and exposes the SQL connector used by server code.

## What It Does

- Reads Firebase/Admin credentials from local env or Google Cloud application default credentials.
- Repairs a known-corrupt `FIREBASE_SERVICE_ACCOUNT_KEY` PEM footer typo (`-----END PRVATE Key-----` → `-----END PRIVATE KEY-----`) on both the `private_key` and derived `privateKey` fields before handing the service account to `cert()`.
- Initializes exactly one Firebase Admin app.
- Returns the generated `trae-contest` Data Connect admin connector.
- Provides `nowIso()` for pipeline timestamps.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getDataConnectDb` | function | Returns the Data Connect admin connector. |
| `isDataConnectConfigured` | function | Reports whether server credentials are available. |
| `nowIso` | function | Returns an ISO timestamp string. |

## Dependencies

- External: `firebase-admin/app`, `firebase-admin/data-connect`.
- Internal generated SDK: `@trae-contest/dataconnect-generated`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Move active runtime code off the old Firestore helper path. Keep Firebase Admin initialization because Data Connect Admin still needs a Firebase app, but do not import or instantiate Firestore.
- 2026-06-30 Codex: Implemented `getDataConnectDb()` with Firebase app initialization and no Firestore Admin dependency.

## Bug Fix: App-Wide Data Connect Credential Failure (Silent Fallback To Stale Cache)

- 2026-06-30 Claude: Owner asked to wipe all data and do a full rescrape/rejudge. Before deleting anything, `scripts/clear-sql.ts --dry-run` reported 0 rows in every table, but the owner's live board (via a long-running local `npm run dev` process) showed 424 topics / 100 evaluated with real-looking entries — a direct contradiction that needed resolving before touching data.
- Root cause: `serviceAccountFromEnv()` here never repaired the known `FIREBASE_SERVICE_ACCOUNT_KEY` PEM footer typo (`-----END PRVATE Key-----`) that `scripts/clear-sql.ts`'s local `normalizeFirebaseServiceAccountEnv()` already worked around. Every real app code path (`getTraeStats`, `listRankedTopics`, `getTopicDetail`, the whole scrape/match/judge pipeline) called this broken `getDataConnectDb()`, got `FirebaseAppError: Failed to parse private key`, and silently fell back to the stale `lib/trae/topics-cache.json` snapshot (`buildBoardDataFromSource`'s catch block, `getTraeStats`'s catch block) instead of surfacing the failure. The exact fallback-constant values (`totalInputTokens: 265582`, `totalOutputTokens: 77612`, `matchedCount: 0` — literals hardcoded in `lib/trae/api.ts`'s `statsPayloadFromCacheTopics()`) showing up in a live API response is what proved this conclusively.
- First fix attempt only repaired the derived camelCase `privateKey` copy, leaving the original `private_key` (snake_case, as parsed straight from the downloaded service-account JSON shape) still broken — `cert()` apparently prefers/reads `private_key` directly, so that first attempt silently no-op'd (verified via a throwaway diagnostic script; see below). Fixed by repairing `account.private_key` itself first, then deriving `privateKey` from the corrected value.
- Verified with `node:crypto`'s `createPrivateKey()` directly (no Firebase involved) that the repaired key parses successfully, and with a fresh dev-server process that `getTraeStats()` then returns the true (all-zero) live state — matching `clear-sql.ts`'s finding exactly. A long-running dev server that had already called `initializeApp()` once (even with a broken credential) will keep serving the broken app forever, because `ensureFirebaseApp()`'s `getApps().length` guard only checks "is any app registered," not "is it healthy" — a code fix to this file requires restarting any already-running server process to take effect.
- Impact: this bug likely also affects the deployed production app if its `FIREBASE_SERVICE_ACCOUNT_KEY` secret has the same typo — every real scrape/match/judge write and every real board/stats read would have been silently failing over to stale local state there too. Since the fix lives in code (not the secret), deploying it fixes production without needing to touch the Vercel/Cloud Run secret value.

## Important Notes / NEVER Change

- This module must stay server-only.
- Do not log service account contents or provider secrets — including partial slices of PEM key material; even a short substring can contain real key bytes.
- When fixing credential-shape bugs, repair the snake_case service-account field itself, not just a derived camelCase copy — `cert()` may read either depending on SDK version, so patching only one silently no-ops.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned Data Connect admin helper. | Codex |
| 2026-06-30 | Implemented Data Connect admin helper. | Codex |
| 2026-06-30 | Fixed silent Data Connect auth failure: repaired the `FIREBASE_SERVICE_ACCOUNT_KEY` PEM footer typo on `private_key` (not just the derived `privateKey` copy) so real DB reads/writes stop silently falling back to the stale local JSON cache. | Claude |
