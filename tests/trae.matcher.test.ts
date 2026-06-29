import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreTopicMatch } from "../lib/trae/matcher.ts";
import type { TraeTopic } from "../lib/trae/types.ts";

function topic(partial: Partial<TraeTopic>): TraeTopic {
  return {
    id: partial.id ?? "topic",
    sourceType: partial.sourceType ?? "preliminary",
    externalTopicId: partial.externalTopicId ?? "1",
    slug: partial.slug ?? "slug",
    title: partial.title ?? "AI 作品",
    url: partial.url ?? "https://forum.trae.cn/t/1",
    authorName: partial.authorName ?? "Noah",
    authorAvatarUrl: null,
    track: partial.track ?? null,
    tags: partial.tags ?? [],
    replyCount: null,
    viewCount: null,
    likeCount: null,
    createdAtExternal: null,
    lastActivityAtExternal: null,
    scrapedAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
    contentText: partial.contentText ?? "一个 AI 学习助手 Demo",
    contentHtml: null,
    excerpt: partial.excerpt ?? "一个 AI 学习助手 Demo",
    demoUrl: null,
    attachmentUrls: [],
    imageUrls: [],
    sessionIds: [],
    traeEvidence: null,
    contentHash: partial.contentHash ?? "hash",
    status: partial.status ?? "scraped",
    rawJson: null,
    rawHtml: null
  };
}

describe("scoreTopicMatch", () => {
  it("gives high confidence to same-author similar-title topics", () => {
    const preliminary = topic({
      sourceType: "preliminary",
      title: "AI 学习助手 初赛 Demo",
      contentText: "面向学生的 AI 学习助手，提供规划、测验和错题分析"
    });
    const signup = topic({
      sourceType: "signup",
      title: "AI 学习助手 报名",
      contentText: "我报名做一个学生学习规划和测验助手"
    });

    const result = scoreTopicMatch(preliminary, signup);

    assert.equal(result.matchMethod, "same_author");
    assert.ok(result.matchConfidence >= 85);
    assert.equal(result.mismatchRisk, "none");
    assert.ok((result.directionConsistencyScore ?? 0) >= 7);
  });

  it("keeps unrelated topics low confidence with high mismatch risk", () => {
    const preliminary = topic({
      authorName: "Alice",
      title: "硬件交互机器人",
      contentText: "机器人通过传感器和实体按钮完成交互"
    });
    const signup = topic({
      sourceType: "signup",
      authorName: "Bob",
      title: "AI 写作工具",
      contentText: "面向自媒体的文章生成和排版工具"
    });

    const result = scoreTopicMatch(preliminary, signup);

    assert.ok(result.matchConfidence < 45);
    assert.equal(result.mismatchRisk, "high");
  });
});
