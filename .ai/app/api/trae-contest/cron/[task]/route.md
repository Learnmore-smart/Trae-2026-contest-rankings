# app/api/trae-contest/cron/[task]/route.ts

> Last updated: 2026-07-11 | Protection: STANDARD

## Purpose

Runs authorized cron tasks for scraping, matching, judging, and the combined TRAE contest pipeline.

## What It Does

- Validates `TRAE_CRON_SECRET` via bearer token or `?secret=`.
- Exposes task names for signup scrape, preliminary scrape, match, judge, and run-all.
- Refreshes the public board snapshot after data-mutating tasks.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GET` / `POST` | route handler | Runs one named cron task after secret validation. |

## Dependencies

- Internal: `lib/trae/auth`, `lib/trae/api`, `lib/trae/judge`, `lib/trae/matcher`, `lib/trae/scraper`.

## Agent Decisions / Thoughts

- 2026-07-04 Codex: User asked for automatic re-scoring of old-system scores after Session ID detection under-counted posts. Cron `judge` and `run-all` should use `mode: "changed"` because that mode already includes unjudged topics while also catching prompt-version mismatches and topics whose extracted evidence changed.
- 2026-07-04 Codex: Implemented changed-mode cron judge/run-all. Source-level tests verify no remaining cron `mode: "unjudged"` calls.

## Bug Fix Plan: Zombie Judge Skip (2026-07-10)

- Symptom: cron/public run-all returns `skipped: judge_already_running` even when nothing is scoring.
- Cause: `hasRecentRunningJudgeRun` only checks status=RUNNING within 10 min and never finalizes killed batches.
- Fix: reclaim stale RUNNING rows first; only skip when a **fresh** RUNNING judge remains.

## Bug Fix: run-all Overall Budget (2026-07-11)

- Symptom: Reclaimed stale RUNNING after ~1600s; second judge pass started after slow scrape and was killed at Cloud Run 900s.
- Fix: `RUN_ALL_BUDGET_MS = 840_000`; shrink or skip second judge when remaining wall clock is insufficient; judge hard-drain guarantees finishRun.

## Important Notes / NEVER Change

- Do not make cron tasks public without secret validation.
- Snapshot refresh is best-effort; it must not turn a successful scrape/match/judge into a failed task.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-04 | Created doc and planned changed-mode cron rejudge. | Codex |
| 2026-07-04 | Implemented changed-mode cron rejudge and verified source guard. | Codex |
| 2026-07-10 | Planned zombie RUNNING reclaim before judge skip guard. | Grok |
