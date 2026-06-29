# lib/trae/auth.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides server-side token extraction and constant-time comparison helpers for admin and cron APIs.

## What It Does

- Reads bearer tokens or explicit headers.
- Validates admin and cron tokens from environment variables.
- Keeps auth checks out of client components.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `extractBearerToken` | function | Reads bearer token or fallback headers. |
| `isValidAdminToken` | function | Validates `TRAE_ADMIN_TOKEN`. |
| `isValidCronSecret` | function | Validates `TRAE_CRON_SECRET`. |

## Dependencies

- Internal: `config`.
- Built-in: `crypto`.

## Important Notes / NEVER Change

- Do not expose token values in API responses or logs.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned auth helper for TRAE API routes. | Codex |
