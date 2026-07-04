# app/api/trae-contest/cron/[task]/route.ts

> Last updated: 2026-07-04 | Protection: STANDARD

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

## Important Notes / NEVER Change

- Do not make cron tasks public without secret validation.
- Snapshot refresh is best-effort; it must not turn a successful scrape/match/judge into a failed task.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-04 | Created doc and planned changed-mode cron rejudge. | Codex |
| 2026-07-04 | Implemented changed-mode cron rejudge and verified source guard. | Codex |
