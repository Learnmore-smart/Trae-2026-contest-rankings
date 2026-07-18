# Project Context

> Last updated: 2026-07-14 | Protection: STANDARD

## Purpose

This repository hosts a public third-party AI ranking site for the TRAE AI Creativity Contest 2026.

## Current Work

- **2026-07-15:** Vision-on bulk throughput: short multimodal timeout, no vision same-model retries, optional Playwright audit off by default, image batch parallel/cap, per-topic vision budget. Keep `TRAE_JUDGE_VISION_ENABLED=true` with concurrency ~32 (not 16000).
- **2026-07-15:** Fixed 开始评分 / 重新评分 request lifecycles: Next.js `after` owns long scoring work, re-score POST acknowledges immediately, and run-status Data Connect reads fall back after 5 seconds instead of hanging the buttons.
- **2026-07-14:** HIGH-SPEED unjudged blast COMPLETE. Wave1: **845** eligible → 835 ok / 10 fail in ~17.5 min (~48–56/min). Wave2 mop-up: **10/10 ok**. All unique-title unjudged posts scored. Remaining board `NEEDS_JUDGING` (~300) are title-duplicates intentionally skipped by judge dedupe. Logs: `judge-blast.log`, `judge-mopup.log`.
- **2026-07-13:** Full rejudge of kimi-k2.6 evals (partial; log `rejudge-kimi-progress.log` last at ~498/758, process no longer running). Can resume later if needed.
- **2026-07-13:** Fixed public 重新评分 `code: "busy"` (stale in-flight locks + soft client retry).
- **2026-07-14:** Investigating a public regrade that landed at 82 instead of the expected ~90 for a hardware-interaction post with a broken live demo but polished uploaded screenshots. Likely fix is to make the judge prompt separate deployment/browser evidence from uploaded product screenshots so a CSS-broken live demo does not drag down completion/design by itself.

## Current State

- The workspace was empty when work started.
- Git metadata became available during setup; the repository now contains a scaffolded Next.js app.
- No existing TRAE judge/compliance skill files were found under the workspace or local skill roots.
- The implementation scaffolded a standalone Next.js App Router project.

## Architecture Decisions

- Use Next.js App Router with TypeScript for the public site, API routes, and admin UI.
- Use Firebase Data Connect generated operations for the SQL-backed contest data path; old Firestore wording should not appear in active UI.
- Keep all scraper, matcher, and judge logic in `lib/trae/*` so scripts and API routes share one implementation.
- Use pure helper modules for extraction, matching, and JSON validation so they can be tested without network or Firestore.
- Public pages must render empty/error states when SQL/Data Connect credentials are missing.
- Use Node 22 `--experimental-strip-types` and `node:test` for local pure-logic tests to avoid extra esbuild-based test dependencies on this Windows path.
- Keep runtime artifacts out of version control: dev-server PID/job files, logs, Playwright MCP captures, test result screenshots, and TypeScript build info are local-only.
- Keep `lib/trae/topics-cache.json` versioned as a compact fallback snapshot for Data Connect-unavailable public ranking/detail behavior; raw scrape payloads must not be included in it.

## Important Notes

- Do not expose REMOVED_PROVIDER or admin secrets to client code.
- Do not scrape private content or bypass forum access controls.
- Registration topics are stored and matched, but never shown as a public ranking.
- Preliminary Demo topics are the only ranking entries.
- Do not commit raw local scrape payloads; if the fallback snapshot is refreshed, strip `rawJson`, `contentHtml`, and `rawHtml`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created project context for TRAE contest module scaffold. | Codex |
| 2026-06-29 | Synced final architecture and verification notes. | Codex |
| 2026-07-01 | Clarified active storage architecture as SQL-backed Firebase Data Connect instead of Firestore. | Codex |
| 2026-07-03 | Documented repository hygiene rule for local runtime artifacts and scrape caches. | Codex |
| 2026-07-03 | Clarified compact fallback snapshot policy after cleanup removed the required cache file. | Codex |

