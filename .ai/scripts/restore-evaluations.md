# scripts/restore-evaluations.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Restores and cleans evaluation rows for prefixed preliminary topic IDs from Data Connect and the local cache.

## What It Does

- Loads cached topic IDs.
- Looks up prefixed and raw topic records.
- Rewrites clean topic/evaluation rows and updates the cache.

## Dependencies

- Internal: `lib/trae/dataconnect.ts`.
- Generated SDK: topic/evaluation mutation helpers from `@trae-contest/dataconnect-generated`.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Planned removal of REMOVED_PROVIDER provider mapping. Restored evaluations should not emit an unsupported REMOVED_PROVIDER provider enum.

## Important Notes / NEVER Change

- Keep prompt-clearing behavior; the script intentionally removes prompt text from restored rows.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created doc before removing REMOVED_PROVIDER provider mapping. | Codex |


