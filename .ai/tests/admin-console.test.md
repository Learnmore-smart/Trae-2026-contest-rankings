# tests/admin-console.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Guards the admin console's compact running-status UI against leaking long action labels into the inline badge.

## What It Does

- Reads `app/admin/admin-client.tsx` as UTF-8 source.
- Verifies the inline busy badge uses generic running copy.
- Verifies the admin run-log empty state names SQL/Data Connect instead of Firestore.
- Verifies the old `正在执行：{busy}` interpolation does not return.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `admin console busy badge test` | node test | Source-level regression guard for compact admin status copy. |

## Dependencies

- Internal: `app/admin/admin-client.tsx`.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Use a source-level Node test to match the repo's existing lightweight regression style instead of introducing a React component harness for a single copy/layout fix.
- 2026-06-30 Codex: The admin source moved to `app/admin`; keep the same busy badge contract and update only the source path.
- 2026-07-01 Codex: The admin page's server actions go through Data Connect generated operations, so the source-level copy test should reject stale Firestore wording in the operator console.

## Important Notes / NEVER Change

- Keep this test focused on the inline busy badge contract, not broader admin-page styling.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-30 | Compact admin status badge exposed scrape action labels. | The badge interpolated the full `busy` string. | Added a source-level regression test for generic running copy. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned admin console busy-badge regression test. | Codex |
| 2026-06-30 | Added the admin console busy-badge regression test. | Codex |
| 2026-06-30 | Updated source path after root-level route move. | Codex |
| 2026-07-01 | Added a source-level regression test for judge `batchMax: 12` and `concurrency: 3`. | Codex |
| 2026-07-01 | Planned SQL/Data Connect admin empty-state wording regression test. | Codex |
| 2026-07-01 | Added SQL/Data Connect admin empty-state wording regression test. | Codex |

## Planned Change: Judge Batch Settings Test

- 2026-07-01 Codex: Add a source-level assertion that the admin judge actions request `batchMax: 12` and `concurrency: 3`.
- Implemented for all three judge actions: unjudged, changed, and low-confidence.

## Change Plan: Shared Judge Policy Test

- 2026-07-01 Codex: Replace literal `12 / 3` expectations with assertions that admin actions use `DEFAULT_JUDGE_BATCH_MAX` and `DEFAULT_JUDGE_CONCURRENCY`.
- Verify the shared policy file defines the aggressive defaults `24 / 6`.
- Implemented in the admin judge policy source-level test.
- 2026-07-01 Codex: Update the shared policy expectations to `48 / 8`.

## Planned Change: Admin Theme Shell Test

- 2026-07-01 Codex: Add a source-level assertion that the admin root `<main>` uses `tech-shell`, matching the public pages' theme wrapper.
- Implemented the admin `tech-shell` source-level assertion.

## Planned Change: SQL/Data Connect Empty State Test

- 2026-07-01 Codex: Add assertions that the admin client contains `SQL/Data Connect` and does not contain the old `Firestore` label.
- Implemented with source-level `SQL/Data Connect` positive and `Firestore` negative assertions.
