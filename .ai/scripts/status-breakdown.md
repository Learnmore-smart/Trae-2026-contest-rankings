# scripts/status-breakdown.ts

> Last updated: 2026-07-04 | Protection: STANDARD

## Purpose

Read-only diagnostic script for explaining why the leaderboard "evaluated" count can differ from total preliminary topics.

## What It Does

- Loads local Next environment variables.
- Connects to Data Connect using the existing project helper.
- Prints `GetStats` preliminary and evaluated counts.
- Scans the full board in 1000-row pages.
- Prints topic counts by status and separates judged topics with good vs negative scores.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `main` | function | Runs the read-only status count scan and prints diagnostics. |

## Dependencies

- Internal: `lib/trae/dataconnect.ts`.
- External: `@next/env`, `@trae-contest/dataconnect-generated`.

## Agent Decisions / Thoughts

- 2026-07-04 Claude: Added during investigation of the decreasing "evaluated" count. The script is read-only and exists to distinguish missing topics from topics currently in `NEEDS_JUDGING` or `JUDGE_ERROR`.
- 2026-07-04 Codex: Kept the script documented because it is useful for future leaderboard status diagnostics; it should not mutate topic status or scores.

## Important Notes / NEVER Change

- Do not add writes, deletes, or rejudge mutations to this script.
- Do not print secrets from `.env`.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-04 | Leaderboard evaluated count appeared to shrink. | `evaluatedCount` is a live `JUDGED` status count, not cumulative progress. | Added a read-only breakdown script to show status distribution. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-04 | Created documentation for the read-only status breakdown script. | Codex |
