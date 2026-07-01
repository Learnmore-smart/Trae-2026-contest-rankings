# app/contest-client.tsx

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Implements the public contest landing and ranking client now mounted at `/` and `/ranking`.

## What It Does

- Fetches public stats, topic rows, run status, and presence data from `/api/trae-contest/*`.
- Renders the landing page, ranking filters, phase switch, run button, and ranking rows/grid.
- Keeps existing ranking rows visible during background reloads.
- Uses route-backed top-level navigation via `/` and `/ranking`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestClient` | component | Shared client UI for landing and ranking pages. |

## Dependencies

- Internal: `./i18n`, `./theme`, `@/lib/trae/types`.
- Public APIs: `/api/trae-contest/stats`, `/api/trae-contest/topics`, `/api/trae-contest/run`, `/api/trae-contest/presence`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: The app has been moved from `/trae-contest-2026` to root-level routes. Future source-level route tests must use `app/page.tsx`, `app/ranking/page.tsx`, and `app/contest-client.tsx`.

## Bug Fix Plan: Stats Request Must Survive Topic Deadline

- 2026-06-30 Codex: Owner reported `DEADLINE_EXCEEDED` plus the public page showing `0/0`. Root cause in the client: stats and topics are loaded with one `Promise.all`, so a deadline in the topic-list request prevents the already-light stats response from being applied.
- Fix strategy: start both fetches concurrently but await/apply the stats response independently before awaiting topics. Topic failure may show a list error, but it must not reset progress stats to null.
- Regression risk: stats and list can be briefly out of sync while the board cache rebuilds; this is acceptable and much better than displaying an empty contest.
- Implemented: `/stats` is started independently and applies `setStats` from its own promise; `/topics` failure no longer prevents the stats payload from being rendered.

## Bug Fix Plan: API Requests Must Respect Base Path

- 2026-06-30 Codex: Owner reported the ranking UI showing `榜单数据加载失败`. Root cause in local reproduction: `next.config.mjs` still sets `basePath: "/trae-contest-2026"`, but the client defaults `API_BASE` to an empty string unless `NEXT_PUBLIC_BASE_PATH` is manually set, so requests go to `/api/trae-contest/*` and return 404 under the configured base path.
- Fix strategy: make the client default API/image path prefix match the configured base path while preserving `NEXT_PUBLIC_BASE_PATH` as an override.
- Regression risk: if the app is later truly moved to root, `next.config.mjs` and this default must be changed together.

## Bug Fix Plan: Ranking Rows Must Not Show Legacy Track Labels

- 2026-06-30 Codex: Owner highlighted row metadata showing labels outside the five official contest tracks. Backend will normalize known legacy labels, but the client should also stop rendering an `Unknown track` placeholder as if it were a category.
- Fix strategy: render the track meta segment only when `item.topic.track` is present after backend normalization. The dropdown remains the fixed five official tracks plus "all".
- Regression risk: rows whose track cannot be recovered will have author/date metadata only until the source data is corrected.
- Implemented: `RankCard` now omits the track meta segment when the normalized API row has no official track.

## Bug Fix Plan: Error States Must Be Readable And Actionable

- 2026-07-01 Codex: Owner reported red-on-red errors and opaque "run interrupted" messages. The ranking client used translucent red backgrounds with red/light text, and `RunButton` ignored the backend `status.error` field.
- Fix strategy: use explicit light/dark contrast classes for ranking errors and render the backend error detail under the run status message when a pipeline run fails.
- Regression risk: backend error strings can be long; keep the detail constrained and wrapped/truncated inside the existing status surface.

## Important Notes / NEVER Change

- Keep the public disclaimer visible.
- Do not clear existing ranking rows during background reloads unless a successful payload replaces them.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created documentation for root-level contest client after route move. | Codex |
| 2026-06-30 | Implemented independent stats loading for Data Connect deadline recovery. | Codex |
| 2026-06-30 | Planned base-path-aware API request fix for ranking load failures. | Codex |
| 2026-06-30 | Planned client-side suppression of unknown/legacy row track labels. | Codex |
| 2026-06-30 | Implemented suppression of unknown row track labels. | Codex |
| 2026-07-01 | Planned readable ranking errors and visible backend pipeline error details. | Codex |
| 2026-07-01 | Implemented readable ranking error panel and surfaced backend pipeline error details. | Codex |
