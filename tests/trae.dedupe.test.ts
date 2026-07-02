import assert from "node:assert/strict";
import test from "node:test";

import { dedupeByTopicTitle, normalizeTitleForDedupe } from "../lib/trae/dedupe.ts";

type Row = {
  id: string;
  topic: {
    title: string;
  };
};

test("normalizes titles for duplicate-post comparison", () => {
  assert.equal(normalizeTitleForDedupe("  TRAE   Idea Hall  "), "trae idea hall");
  assert.equal(normalizeTitleForDedupe("【学习工作赛道】 假如你是XXX — 沉浸式历史开放世界探索体验"), "【学习工作赛道】 假如你是xxx — 沉浸式历史开放世界探索体验");
});

test("dedupes topic rows by normalized title while keeping the first ordered row", () => {
  const rows: Row[] = [
    { id: "high-score", topic: { title: "【学习工作赛道】 假如你是XXX — 沉浸式历史开放世界探索体验" } },
    { id: "other", topic: { title: "智慧助老赛道 · 读单" } },
    { id: "duplicate-low-score", topic: { title: " 【学习工作赛道】 假如你是xxx — 沉浸式历史开放世界探索体验 " } }
  ];

  assert.deepEqual(dedupeByTopicTitle(rows).map((row) => row.id), ["high-score", "other"]);
});

test("does not collapse blank-title rows into unrelated duplicates", () => {
  const rows: Row[] = [
    { id: "blank-a", topic: { title: "" } },
    { id: "blank-b", topic: { title: "   " } },
    { id: "named", topic: { title: "Named topic" } }
  ];

  assert.deepEqual(dedupeByTopicTitle(rows).map((row) => row.id), ["blank-a", "blank-b", "named"]);
});
