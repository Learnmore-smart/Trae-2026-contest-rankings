# app/api/trae-contest/run/route.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Provides the public manual pipeline trigger for scrape -> match -> judge.

## What It Does

- Exposes `GET` for current in-memory pipeline status.
- Exposes `POST` to start one manual pipeline run, guarded by an in-process lock and cooldown.
- Runs scraping, matching, and one bounded judging batch in the background, then refreshes the board cache.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GET` | route handler | Returns current pipeline status. |
| `POST` | route handler | Starts the public pipeline if not already running. |

## Dependencies

- Internal: `lib/trae/api`, `lib/trae/judge`, `lib/trae/matcher`, `lib/trae/scraper`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Manual scoring is bounded by `TRAE_MAX_JUDGE_PER_RUN`/`maxJudgePerRun`; at 30 RPM, a full 1800-3000 item scoring run is hour-scale, so the public route should not imply that one click scores everything.

## Bug Fix Plan: Surface Bounded Judge Batch Result

- 2026-06-30 Codex: Owner observed scoring stopped at 90. Evidence: `judgeChangedTraeTopics()` slices candidates to `config.maxJudgePerRun`, and the deployed value appears to be 90. This is a batch ceiling, not necessarily a data-loss event.
- Fix strategy: capture the judge result in `runPipeline()` and include the evaluated/failed counts in the final status message so the UI reports what the manual run actually processed.
- Regression risk: do not remove the in-flight lock or cooldown; do not start an unbounded hour-long public request.
- Implemented: `runPipeline()` stores `judgeResult` and includes evaluated/failed counts in the final `done` message.

## Important Notes / NEVER Change

- Do not add admin token requirements to the public button unless the UI is changed to match.
- Do not put provider secrets or raw model output in this status payload.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-30 | Public run looked like a full scoring pass but only advanced 90 items. | The judge step is intentionally capped per run and the status message hid the cap. | Planned to include per-batch judge counts in the completion message. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created route documentation and planned batch-count status fix. | Codex |

## Planned Change: Public Scrape Plus Immediate Judge

- 2026-07-01 Codex: Owner clarified the public click must still run scrape/match, but existing unjudged work should begin judging immediately instead of waiting behind scrape.
- Implement with two bounded `unjudged` judge passes: one concurrent with scrape/match for existing backlog, and one after matching for newly discovered backlog.
- Keep the public lock, cooldown, and board snapshot refresh.
- Implemented with `PUBLIC_JUDGE_MAX = 12`, `PUBLIC_JUDGE_CONCURRENCY = 3`, immediate `judgeUnjudgedBatch()`, concurrent `scrapeAndMatch`, and a post-match judge batch.

## Change Plan: Shared Aggressive Judge Defaults

- 2026-07-01 Codex: Replace route-local `12 / 3` constants with shared `DEFAULT_JUDGE_BATCH_MAX = 24` and `DEFAULT_JUDGE_CONCURRENCY = 6` from `lib/trae/judge-policy.ts`.
- Keep the public behavior the same: judge existing backlog immediately, scrape/match concurrently, then judge newly matched backlog.
- Implemented by importing the shared constants and passing them into `judgeChangedTraeTopics()`.
