# app/trae-contest-2026/admin/admin-client.tsx

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Implements the token-based admin panel for manual scraper, matcher, and judge actions.

## What It Does

- Stores admin token locally in component state/localStorage.
- Calls admin APIs with bearer token.
- Shows recent runs and error logs.
- Shows a generic running badge while admin actions are in flight without echoing the underlying action label into the compact status UI.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `AdminClient` | component | Client-side admin console. |

## Dependencies

- Admin APIs under `/api/trae-contest/admin/*`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Redesign admin as an operator console with clear pipeline actions, run status, and configuration guidance, while keeping the token entirely client-entered and never sourced from bundled env vars.
- 2026-06-30 Codex: Keep the `busy` state for disabling controls and completion messaging, but render a generic running badge so the narrow inline status row does not leak long action labels such as scrape targets.

## Important Notes / NEVER Change

- The token is passed only to server APIs; it must never be bundled from env into the client.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-30 | Compact admin status row showed long scrape action labels like `抓取报名专区`, producing a crowded badge. | The inline busy badge rendered `正在执行：{busy}` and `busy` stored the full action label. | Keep `busy` for control state, but switch the inline badge to generic running copy and cover it with a regression test. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned admin client. | Codex |
| 2026-06-29 | Planned operator-console redesign. | Codex |
| 2026-06-29 | Implemented operator-console redesign with clearer automation guidance and run cards. | Codex |
| 2026-06-30 | Planned compact busy-badge fix and regression coverage. | Codex |
| 2026-06-30 | Replaced the inline busy label with a generic running badge and kept the action label only for completion messaging. | Codex |
