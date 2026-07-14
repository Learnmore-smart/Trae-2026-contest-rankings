# scripts/rejudge-by-model.ts

> Last updated: 2026-07-13 | Protection: STANDARD

## Purpose

Batch-rejudge all preliminary topics whose latest evaluation was produced by a given model (default `moonshotai/kimi-k2.6`).

## What It Does

- Scans `GetBoardPage` for latest `evaluations_on_topic[0].model` matching the filter.
- Calls `rejudgeTopicById` with configured concurrency.
- Writes board snapshots periodically and once at the end.
- Prints before-score stats and score-delta summary.

## Usage

```bash
node --experimental-strip-types scripts/rejudge-by-model.ts
node --experimental-strip-types scripts/rejudge-by-model.ts moonshotai/kimi-k2.6 80
# faster bulk (text-only):
# $env:TRAE_JUDGE_VISION_ENABLED="false"; node --experimental-strip-types scripts/rejudge-by-model.ts
```

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Re-score all ~1201 kimi-k2.6 latest evaluations (text-only multi-evaluator) via nemotron / DeepSeek-V3.2 / gpt-oss-120b.
- **Running:** `node --experimental-strip-types scripts/rejudge-by-model.ts moonshotai/kimi-k2.6 28` with env overrides (vision OFF, friend-first).
- **Progress log:** `rejudge-kimi-progress.log` (workspace root). Re-run is safe: only rows still on kimi are picked.
- **Next steps:** Let job finish; re-run once for any remaining FAIL/kimi leftovers; write board snapshot if needed.

## Agent Decisions / Thoughts

- **2026-07-13:** User reported kimi-k2.6 scores systematically low. Rejudge uses current judge (multi-evaluator consensus), not kimi. Model filter is substring match so `kimi` also works.
- Prefer re-scan by model after run rather than a static ID list so re-runs only hit remaining kimi rows.

## Important Notes / NEVER Change

- Do not put kimi back into FRIEND_PRIMARY/FALLBACK for this job.
- Keep using `rejudgeTopicById` so persistence + empty/not_found handling stay consistent with public re-score.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created for full kimi-k2.6 re-score blast. | Grok |
