# tests/admin-console.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Guards the admin console's compact running-status UI against leaking long action labels into the inline badge.

## What It Does

- Reads `app/admin/admin-client.tsx` as UTF-8 source.
- Verifies the inline busy badge uses generic running copy.
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
