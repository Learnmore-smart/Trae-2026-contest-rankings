# README.md

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Documents environment variables, Firestore setup, local scripts, deployment, scheduler setup, and zero-budget NVIDIA/REMOVED_PROVIDER backoff behavior.

## What It Does

- Gives operators enough information to run the public site and workers locally or in cloud.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Planned README update from REMOVED_PROVIDER-only scoring to NVIDIA-first zero-budget provider order with REMOVED_PROVIDER free fallback only.

## Important Notes / NEVER Change

- README must not document official DeepSeek paid API or any paid fallback path.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned README documentation. | Codex |
| 2026-06-29 | Planned zero-budget AI provider documentation update. | Codex |
| 2026-06-29 | Documented NVIDIA-first zero-budget provider order, REMOVED_PROVIDER fallback, and `callLLMWithFallback()` behavior. | Codex |
## Change Plan: Remove REMOVED_PROVIDER Documentation

- 2026-07-03 Codex: Update README setup and fallback notes to Friend primary plus NVIDIA fallback only.
- Remove REMOVED_PROVIDER keys, model defaults, and fallback claims.

