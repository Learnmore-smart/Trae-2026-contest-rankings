# lib/trae/runs.ts

> Last updated: 2026-07-11 | Protection: STANDARD

## Purpose

Creates and updates SQL `runs` records for scraper, matcher, and judge jobs.

## What It Does

- Starts a run row with status `running`.
- Appends bounded logs.
- Finishes runs as success, partial, or error.
- Reclaims stale `RUNNING` rows that were killed mid-flight without `finishRun` (Cloud Run timeout / CPU throttle / OOM).

## Public API

| Name | Type | Description |
|------|------|-------------|
| `startRun` | function | Creates a run document. |
| `finishRun` | function | Updates status and counters. |
| `STALE_RUNNING_RUN_MS` | constant | Age above which a RUNNING row is a zombie. |
| `isFreshRunningRun` | function | True when status is running and started within the fresh window. |
| `reclaimStaleRunningRuns` | function | Finalizes zombie RUNNING rows as error so new work can start. |

## Dependencies

- Internal: `dataconnect`, `types`. Callers pass `listRuns()` results into `reclaimStaleRunningRuns`.
- Generated SDK: `upsertRun`, `finishRun`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep run logging small to avoid oversized persistence payloads.
- 2026-06-30 Codex: Run tracking should use Data Connect mutations only.
- 2026-07-10 Grok: Production DB has many forever-RUNNING judge/match/scrape rows (process killed before finishRun). Public "开始评分" and cron `hasRecentRunningJudgeRun` treat those as live work, so clicks no-op for up to 10–15 minutes and scoring freezes. Reclaim zombies older than `STALE_RUNNING_RUN_MS` (aligned with max legitimate Cloud Run batch, ~15 min) before start/skip guards.

## Bug Fix: Zombie RUNNING Blocks Scoring (2026-07-10)

**Discovered**: 2026-07-10
**Description**: Clicking public 开始评分 does not advance 已评分; runs table shows many `status=running` with `finishedAt=null` for hours.
**Root Cause**: Pipeline writes `startRun` then dies (timeout/throttle) without `finishRun`. Guards treat any recent RUNNING judge as in-flight and skip or show fake progress.
**Fix Strategy**: Shared fresh/stale helpers + `reclaimStaleRunningRuns` on public POST and cron entry; only skip when a *fresh* RUNNING judge exists.
**Impact**: `lib/trae/runs.ts`, `app/api/trae-contest/run/route.ts`, `app/api/trae-contest/cron/[task]/route.ts`
**Test Plan**: Source guards in `tests/contest-route-pages.test.ts`; manual listRuns should show reclaimed errors after POST.

## Important Notes / NEVER Change

- Do not log secrets or full raw model payloads into run logs.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned run tracking helper. | Codex |
| 2026-06-30 | Planned Data Connect run-tracking cleanup. | Codex |
| 2026-06-30 | Implemented Data Connect run-tracking import cleanup. | Codex |
| 2026-07-10 | Documented zombie RUNNING reclaim for public/cron scoring unblock. | Grok |
| 2026-07-11 | Reclaim remains the safety net; primary fix for 1600s reclaim UX is hard-drain finishRun in judge so zombies should become rare. | Grok |
