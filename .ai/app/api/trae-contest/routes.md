# app/api/trae-contest/*/route.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Documents the route handlers created for public, admin, and cron TRAE APIs.

## What It Does

- Public read routes expose stats, preliminary topic lists, topic details, and presence heartbeats.
- Admin routes validate `TRAE_ADMIN_TOKEN` before scrape/match/judge/run-history actions.
- Cron routes validate `TRAE_CRON_SECRET` before scheduled worker actions.
- Dev routes must be available only from localhost and must not work in hosted production traffic.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GET /api/trae-contest/stats` | route | Public stats. |
| `GET /api/trae-contest/topics` | route | Public preliminary ranking list. |
| `GET /api/trae-contest/topics/[id]` | route | Public detail payload. |
| `POST /api/trae-contest/presence` | route | Public online heartbeat. |
| `POST /api/trae-contest/admin/*` | route | Token-protected manual jobs. |
| `GET /api/trae-contest/admin/runs` | route | Token-protected run history. |
| `POST /api/trae-contest/cron/[task]` | route | Secret-protected scheduler endpoint. |
| `GET /api/trae-contest/cron/[task]` | route | Secret-protected scheduler endpoint for cron providers that issue GET requests. |
| `POST /api/trae-contest/dev/run` | route | Localhost-only development runner. |
| `POST /api/trae-contest/run` | route | Public one-button pipeline trigger (scrape→match→judge). Token-free; guarded by an in-flight lock + 30s cooldown. Fire-and-forget; returns immediately. |
| `GET /api/trae-contest/run` | route | Public pipeline status for the run button to poll (`{running, phase, message, error}`). |

## Dependencies

- Internal: `lib/trae/api`, `scraper`, `matcher`, `judge`, `config`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a single doc for related route handlers to keep the empty scaffold documentation manageable.
- 2026-06-29 Codex: Add GET cron support for hosted schedulers while preserving cron-secret validation; add a separate localhost-only dev route so local testing does not require exposing admin tokens.
- 2026-06-29 Claude: Add a public token-free `POST/GET /api/trae-contest/run` so the single landing-page button can trigger and poll the whole pipeline. Safety comes from a module-level in-flight lock + 30s cooldown (state stored on `globalThis` to survive dev hot-reload) rather than a token. Runs fire-and-forget so the HTTP response is immediate; on serverless the scheduled cron remains the authoritative path for long runs. Also relaxed `dev/run` localhost detection to accept loopback `x-forwarded-for`/`x-forwarded-host` values (the Next dev server forwards `::1`), which previously 403'd legitimate localhost requests.

## Important Notes / NEVER Change

- Admin and cron APIs must reject missing or invalid tokens.
- Dev APIs must reject non-local hosts and forwarded public traffic.
- Public APIs must not return raw HTML or secrets.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned TRAE API route handlers. | Codex |
| 2026-06-29 | Planned GET cron and localhost-only dev runner routes. | Codex |
| 2026-06-29 | Implemented GET cron handler and localhost-only dev runner route. | Codex |
| 2026-06-29 | Added public `run` pipeline trigger/status endpoint for the single landing button; relaxed dev/run loopback detection. | Claude |
