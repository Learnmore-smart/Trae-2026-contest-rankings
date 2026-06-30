# vercel.json

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Configures hosted cron scheduling for the TRAE contest background pipeline.

## What It Does

- Schedules periodic calls to the TRAE cron route.
- Relies on `TRAE_CRON_SECRET` validation in the route handler.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `crons` | config | Hosted cron declarations. |

## Dependencies

- Internal: `app/api/trae-contest/cron/[task]/route.ts`.
- External: Vercel cron infrastructure.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Add scheduler configuration so the repo has an explicit automatic fetch path; the route stays protected and should be paired with `TRAE_CRON_SECRET` in deployment.

## Important Notes / NEVER Change

- Do not put secrets directly in this file.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned hosted cron config. | Codex |
| 2026-06-29 | Added 30-minute `run-all` cron declaration. | Codex |
