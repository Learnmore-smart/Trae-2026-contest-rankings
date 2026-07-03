# dataconnect/schema/schema.gql

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Defines the Firebase Data Connect SQL schema for topics, evaluations, runs, matches, presence, token usage, and scrape cursors.

## What It Does

- Owns Data Connect enum names and table shapes.
- Provides the `TraeAiProvider` enum consumed by generated Admin SDK types.
- Stores Friend and NVIDIA model usage under the existing `NVIDIA` provider enum value.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeAiProvider` | enum | Persisted AI provider bucket for evaluations and token usage. |

## Dependencies

- Internal: `lib/dataconnect-generated/*` must match this schema.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Planned deletion of the `REMOVED_PROVIDER` enum value at the owner's request. Friend continues to persist as `NVIDIA` to avoid adding another provider bucket.

## Important Notes / NEVER Change

- Keep generated SDK enum declarations in sync with this schema when enum values change.
- Do not store API keys or endpoint secrets in the schema.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created schema doc before removing `REMOVED_PROVIDER` from `TraeAiProvider`. | Codex |


