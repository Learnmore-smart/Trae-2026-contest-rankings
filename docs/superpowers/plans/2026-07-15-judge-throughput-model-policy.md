# Judge Throughput and Model Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grade unjudged TRAE posts with 1,600 topic workers, resilient retry behavior, and only DeepSeek V4 Pro or Nemotron Ultra 3 text models.

**Architecture:** Configuration owns the model allow-list and retry limits; the existing fallback client retains retry, key rotation, and backoff behavior. The concurrency policy supplies a 1,600-worker default while `.env` makes the local command immediately use that value.

**Tech Stack:** TypeScript, Node test runner, Next.js environment configuration.

---

### Task 1: Lock the requested policy with tests

**Files:**
- Modify: `tests/trae.llm.test.ts`
- Modify: `tests/trae.judge.test.ts`

- [ ] Add assertions that the default text fallback plan includes only `deepseek-ai/deepseek-v4-pro` and `nvidia/nemotron-3-ultra-550b-a55b`, in friend-first then NVIDIA order.
- [ ] Add an assertion that `DEFAULT_JUDGE_CONCURRENCY` is `1600` and the batch cap remains no less than that value.
- [ ] Run `node --experimental-strip-types --test tests/trae.llm.test.ts tests/trae.judge.test.ts` and confirm the old defaults fail those assertions.

### Task 2: Change configuration defaults and runtime overrides

**Files:**
- Modify: `lib/trae/config.ts`
- Modify: `lib/trae/judge-policy.ts`
- Modify: `.env`
- Modify: `.env.example`

- [ ] Set both provider text model chains to DeepSeek V4 Pro then Nemotron Ultra 3.
- [ ] Set the default and local `TRAE_JUDGE_CONCURRENCY` to `1600`, and set local `TRAE_MAX_JUDGE_PER_RUN` to at least `1600`.
- [ ] Keep the existing exponential transient retry, key rotation, rate-limit backoff, and bounded wall-clock retry policy; set the local rate-limit retry count to `0` so the client retries until its existing time ceiling is reached.

### Task 3: Verify the effective policy

**Files:**
- Modify: `.ai/lib/trae/config.md`
- Modify: `.ai/lib/trae/judge-policy.md`
- Modify: `.ai/lib/trae/llm.md`
- Modify: `.ai/.env.md`
- Modify: `.ai/.env.example.md`

- [ ] Run the focused LLM and judge tests.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Record the verified model order, 1,600-worker policy, and retry semantics in the mirror documents.
