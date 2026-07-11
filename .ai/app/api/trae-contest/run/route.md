# app/api/trae-contest/run/route.ts

> Last updated: 2026-07-11 | Protection: STANDARD

## Purpose

Provides the public manual pipeline trigger for scrape -> match -> judge.

## What It Does

- Exposes `GET` for pipeline status: prefers fresh in-memory state, otherwise derives a cross-instance status from the persistent runs table (`listRuns`).
- Exposes `POST` to start one manual pipeline run, guarded by an in-process lock, a DB-backed "already running" check, and a cooldown (memory + DB `finishedAt`).
- On Cloud Run (cron secret configured), POST self-invokes `/api/trae-contest/cron/run-all` with `x-trae-cron-secret` so the work runs inside a request that keeps CPU allocated up to the 900s service timeout. Without a cron secret (local dev), it falls back to the legacy in-process fire-and-forget `runPipeline`.

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

## Bug Fix Plan: "开始评分" Button Does Nothing On Cloud Run (2026-07-09)

- Symptom: clicking the public 开始评分 button appears to do nothing — the button flips to 运行中 for ~2s, then silently resets; the scored count never moves.
- Root cause 1 (split-brain status): pipeline status lives only in `globalThis.__traePipeline`, which is per-process. On Cloud Run with >1 instance (or after instance recycling), the POST starts a run on instance A while the 2s GET polls land on instance B, which reports `idle`; the client sees `running: false`, stops polling, and silently resets the button.
- Root cause 2 (throttled background work): POST fires `void runPipeline(state)` and returns immediately. With Cloud Run request-based billing, instance CPU is throttled to near-zero once the response is sent, so the fire-and-forget scrape → match → judge pipeline stalls or dies mid-flight (the same "zombie RUNNING run" failure mode documented in `lib/trae/judge.md` / `config.ts` for over-deadline cron batches). Nothing actually gets graded from the button.
- Fix strategy:
  1. POST self-invokes the existing `/api/trae-contest/cron/run-all` endpoint (using `config.cronSecret` in the `x-trae-cron-secret` header, host taken from the incoming request's forwarded headers). The work then runs inside a normal request that keeps full CPU for up to the 900s Cloud Run timeout and reuses run-all's judge deadlines and `judge_already_running` guard. Local dev (no cron secret) keeps the in-process pipeline.
  2. GET derives status from the persistent runs table when in-memory state is not an active fresh run: a RUNNING run started within 15 min → running (phase mapped from run type); otherwise a run finished within the last 2 min → done/error with judge counts; otherwise fall back to memory. A short module cache (2.5s) keeps polling from hammering Data Connect.
  3. POST guards cross-instance: a RUNNING run in the DB → return that running status instead of double-starting; DB `finishedAt` within 30s → cooldown reply.
  4. Client (`RunButton`): after POST, ignore `running: false` polls for a ~15s grace window so the run-all request has time to write its first RUNNING row before polls can settle the UI.
- Regression risk: keep the in-flight lock, cooldown, bounded batches, and the exact source shapes asserted by `tests/contest-route-pages.test.ts` (`judgeChangedBatch`, `immediateJudge`, `postMatchJudgeResult`, client trigger `setStatus` line). A stale in-memory `running` (>20 min) must not lock POST forever.

## Important Notes / NEVER Change

- Do not add admin token requirements to the public button unless the UI is changed to match.
- Do not put provider secrets or raw model output in this status payload.
- Do not put the cron secret in a URL query parameter (it would leak into request logs); header only.

## Bug Fix Plan: Zombie RUNNING + Fragile Handoff (2026-07-10)

- Symptom: 已评分 stuck (e.g. 4567/6495); 开始评分 shows 运行中 then never advances scores. DB has many `judge_*` / `match_*` rows stuck at `RUNNING` for hours.
- Root cause 1: July 9 self-invoke still used `void invokeCronRunAll` + 250ms sleep. On Cloud Run, CPU throttles after the response; outbound fetch often dies after `startRun` writes RUNNING but before `finishRun` → forever zombies.
- Root cause 2: GET/POST treat any RUNNING row within 15 min as live. Zombies make the button report "running" or skip start while nothing scores. Cron `hasRecentRunningJudgeRun` (10 min) same issue.
- Fix strategy:
  1. `reclaimStaleRunningRuns()` on POST (and cron) via `lib/trae/runs.ts` so zombies become ERROR and no longer block.
  2. `statusFromRuns` / skip guards only count **fresh** RUNNING rows (`isFreshRunningRun`).
  3. Handoff: await self-invoke until a fresh RUNNING row appears (or fetch settles / early failure), keeping CPU on the POST request; then detach and let run-all continue request-bound. Early failure still falls back to in-process `runPipeline`. Do not return after a blind 250ms sleep.
- Regression risk: keep cooldown, cron secret in header only, and source shapes required by tests.

## Bug Fix Plan: Self-Invoke Connect Timeout → Silent Idle (2026-07-10 evening)

- Symptom (production probe): POST `/api/trae-contest/run` returns in ~11.4s with
  `{ running: false, phase: "idle", message: "等待运行。" }` — button flashes 运行中 then
  resets; scored count does not move (user report: 4624/6495 stuck, last update 7/10 12:53).
- Root cause:
  1. Public POST self-invokes the public/cron URL via `fetch`. On Cloud Run this often fails
     around undici's ~10s connect timeout (self-ingress, concurrency starvation, or egress).
  2. `EARLY_INVOKE_FAILURE_MS = 10_000` is aligned with that connect timeout. Failures that
     settle at ~11s take the **late** branch, which assumes work may still be running and
     only resets memory to idle — **without** checking for a RUNNING handoff row and
     **without** falling back to in-process `runPipeline`.
  3. Result: click is a pure no-op after ~11s.
- Fix strategy:
  1. Self-invoke via **loopback** `http://127.0.0.1:$PORT` + request pathname (keeps basePath,
     avoids public ingress/egress). Secret still only in header.
  2. On **any** self-invoke failure: if this dispatch has **no** fresh RUNNING handoff evidence,
     always `await runPipeline(state)` (in-process, request-bound). Only defer to the runs
     table when handoff was already observed (true late loss of response body).
  3. Raise `EARLY_INVOKE_FAILURE_MS` to 30s as a secondary safety net (connect timeout no
     longer lands in a silent-idle path).
  4. Client: start polling immediately on click (do not wait for POST body) so long
     in-process fallbacks still refresh status from GET/DB; if POST returns idle with no
     error after a start attempt, surface `phase: "error"` so the button does not look dead.
- Regression risk: keep cooldown, secret-not-in-query, handoff detach when RUNNING exists,
  and source shapes in `tests/contest-route-pages.test.ts`. Loopback must preserve basePath.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-30 | Public run looked like a full scoring pass but only advanced 90 items. | The judge step is intentionally capped per run and the status message hid the cap. | Planned to include per-batch judge counts in the completion message. |
| 2026-07-09 | 开始评分 button silently did nothing in production. | In-memory status is per-instance (split-brain with multi-instance Cloud Run) and fire-and-forget background work is CPU-throttled after the POST response. | POST self-invokes cron run-all (request-bound CPU); GET derives cross-instance status from the runs table; client adds a post-POST grace window. |
| 2026-07-10 | 开始评分 still does not score; many forever-RUNNING runs in DB. | Self-invoke handoff too short (CPU throttle mid-flight) + zombie RUNNING rows block/skip new work. | Reclaim stale RUNNING; only treat fresh runs as active; hold POST open until pipeline handoff evidence. |
| 2026-07-10 | 开始评分 still no-ops (~11s → idle). | Self-invoke connect timeout > EARLY window; late path silent idle without handoff check. | Loopback self-invoke; fallback whenever no handoff evidence; client polls on click. |
| 2026-07-11 | 重试评分 → 运行中断 / Reclaimed stale RUNNING after 1600s. | Soft deadline only; in-flight drain past 900s kill; runPipeline used 690s×2. | Hard drain finishRun; runPipeline 300s/pass deadlines; friendlier reclaim message. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created route documentation and planned batch-count status fix. | Codex |
| 2026-07-09 | Documented and fixed the Cloud Run split-brain/no-op button: cron self-invocation + DB-derived status. | Claude |
| 2026-07-10 | Documented zombie reclaim + reliable run-all handoff for public scoring button. | Grok |
| 2026-07-10 | Fixed silent idle after self-invoke connect timeout: loopback URL + handoff-gated fallback. | Grok |

## Planned Change: Public Scrape Plus Immediate Judge

- 2026-07-01 Codex: Owner clarified the public click must still run scrape/match, but existing unjudged work should begin judging immediately instead of waiting behind scrape.
- Implement with two bounded `unjudged` judge passes: one concurrent with scrape/match for existing backlog, and one after matching for newly discovered backlog.
- Keep the public lock, cooldown, and board snapshot refresh.
- Implemented with `PUBLIC_JUDGE_MAX = 12`, `PUBLIC_JUDGE_CONCURRENCY = 3`, immediate `judgeUnjudgedBatch()`, concurrent `scrapeAndMatch`, and a post-match judge batch.

## Change Plan: Shared Aggressive Judge Defaults

- 2026-07-01 Codex: Replace route-local `12 / 3` constants with shared `DEFAULT_JUDGE_BATCH_MAX = 24` and `DEFAULT_JUDGE_CONCURRENCY = 6` from `lib/trae/judge-policy.ts`.
- Keep the public behavior the same: judge existing backlog immediately, scrape/match concurrently, then judge newly matched backlog.
- Implemented by importing the shared constants and passing them into `judgeChangedTraeTopics()`.
- 2026-07-01 Codex: With shared defaults raised to `100 / 20`, public run should still use `mode: "unjudged"` so it advances the public scored count before optional stale-score rejudges.

## Planned Fix: Automatic Rejudge For Extractor Updates

- 2026-07-04 Codex: User report says Session ID detection under-counted a submitted post and asked for either a manual re-detect button or automatic re-scoring of old-system scores.
- Root cause: public run only calls `mode: "unjudged"`, so already-scored topics whose extracted evidence changed are not rejudged by the public button. `changed` mode already covers unjudged topics, prompt-version mismatches, judge errors, and topics with `updatedAt` newer than the latest evaluation.
- Fix strategy: switch the public immediate and post-match judge passes to `mode: "changed"` after scraper upsert begins bumping `updatedAt` for session/evidence changes. This keeps one public button but makes it a real re-detect/re-score path.
- Regression risk: keep the in-flight lock, cooldown, and bounded batch/concurrency. Do not reset judged status during scrape.
- Implemented: renamed the public helper to `judgeChangedBatch()` and both immediate/post-match passes now call `judgeChangedTraeTopics({ mode: "changed", max: DEFAULT_JUDGE_BATCH_MAX, concurrency: DEFAULT_JUDGE_CONCURRENCY })`.
