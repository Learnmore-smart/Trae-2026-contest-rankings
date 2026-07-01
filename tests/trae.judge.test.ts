import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsensusJudgePrompt,
  buildJudgePrompt,
  getJudgeEvaluatorProfiles,
  parseEvaluationJson,
  runWithConcurrency
} from "../lib/trae/judge.ts";
import type { EvaluationOutput, TraeTopic } from "../lib/trae/types.ts";

const validPayload: EvaluationOutput = {
  totalScore: 82,
  innovationScore: 25,
  practicalityScore: 24,
  completionScore: 17,
  designScore: 16,
  complianceRiskScore: 2,
  directionConsistencyScore: 8,
  confidenceScore: 76,
  competitionLevel: "有竞争力",
  summary: "Demo 完整，方向清晰，但材料仍可补强。",
  strengths: ["有明确用户场景"],
  weaknesses: ["Demo 链接说明不足"],
  suggestions: ["补充更多开发过程截图"],
  complianceRisks: ["缺少 3 个 Session ID"],
  dimensionComments: {
    innovation: "有一定创新",
    practicality: "场景明确",
    completion: "可体验",
    design: "体验完整"
  },
  matchComment: "与报名方向基本一致"
};

describe("parseEvaluationJson", () => {
  it("parses fenced strict JSON into a validated evaluation object", () => {
    const parsed = parseEvaluationJson(`\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``);
    assert.equal(parsed.totalScore, 82);
    assert.equal(parsed.competitionLevel, "有竞争力");
  });

  it("rejects invalid score ranges", () => {
    assert.throws(() =>
      parseEvaluationJson(
        JSON.stringify({
          ...validPayload,
          innovationScore: 31
        })
      )
    );
  });
});

describe("multi-evaluator judging", () => {
  const topic = {
    id: "topic-1",
    sourceType: "preliminary",
    externalTopicId: "123",
    slug: "demo-post",
    title: "Static demo that needs stricter review",
    url: "https://forum.example.test/t/demo-post/123",
    authorName: "Noah",
    authorAvatarUrl: null,
    track: "学习工作",
    tags: ["AI"],
    replyCount: 2,
    viewCount: 99,
    likeCount: 5,
    createdAtExternal: null,
    lastActivityAtExternal: null,
    scrapedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    contentText: "This post links a demo and screenshots, but the judge has not opened either.",
    contentHtml: null,
    excerpt: "Demo excerpt",
    demoUrl: "https://demo.example.test",
    attachmentUrls: [],
    imageUrls: ["https://forum.example.test/a.png", "https://forum.example.test/b.png"],
    sessionIds: ["s1", "s2", "s3"],
    traeEvidence: {
      hasDemoUrl: true,
      hasTraeProcess: true,
      screenshotCount: 2,
      sessionIdCount: 3,
      hasThreeScreenshots: false,
      hasThreeSessionIds: true,
      processKeywords: ["TRAE"]
    },
    contentHash: "hash",
    status: "needs_judging",
    rawJson: null,
    rawHtml: null
  } satisfies TraeTopic;

  it("uses four independent evaluator profiles before consensus", () => {
    assert.deepEqual(
      getJudgeEvaluatorProfiles().map((profile) => profile.id),
      ["product", "technical", "ux", "risk"]
    );
  });

  it("discloses image and demo evidence limits in the base prompt when no visual evidence was gathered", () => {
    const prompt = buildJudgePrompt(topic, null);

    assert.match(prompt, /https:\/\/forum\.example\.test\/a\.png/);
    assert.match(prompt, /本轮未进行视觉识别/);
    assert.match(prompt, /截图或视觉识别未成功/);
  });

  it("reports no demo URL distinctly from a failed screenshot attempt", () => {
    const prompt = buildJudgePrompt({ ...topic, demoUrl: null }, null);
    assert.match(prompt, /未检测到 Demo 链接/);
  });

  it("surfaces real image and demo vision summaries in the prompt instead of the not-performed disclaimer", () => {
    const prompt = buildJudgePrompt(topic, null, {
      imageEvidence: { summary: "截图显示一个可交互的待办事项列表界面。", provider: "nvidia", model: "moonshotai/kimi-k2.6" },
      demoEvidence: { summary: "页面是一个静态营销落地页，没有可操作的产品功能。", provider: "nvidia", model: "moonshotai/kimi-k2.6" }
    });

    assert.match(prompt, /截图显示一个可交互的待办事项列表界面/);
    assert.match(prompt, /页面是一个静态营销落地页，没有可操作的产品功能/);
    assert.doesNotMatch(prompt, /本轮未进行视觉识别/);
    assert.doesNotMatch(prompt, /截图或视觉识别未成功/);
  });

  it("builds a consensus prompt from all evaluator outputs and evidence limits", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      }))
    );

    assert.match(prompt, /Static demo that needs stricter review/);
    assert.match(prompt, /image vision was not performed/i);
    assert.match(prompt, /interactive demo browsing was not performed/i);
    for (const profile of profiles) {
      assert.match(prompt, new RegExp(profile.id));
      assert.match(prompt, new RegExp(profile.label));
    }
  });

  it("tells the consensus referee when visual evidence WAS actually gathered", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      })),
      {
        imageEvidence: { summary: "图片显示营销图，非产品截图。", provider: "nvidia", model: "moonshotai/kimi-k2.6" },
        demoEvidence: { summary: "Demo 是一个静态落地页。", provider: "nvidia", model: "moonshotai/kimi-k2.6" }
      }
    );

    assert.match(prompt, /image vision WAS performed/);
    assert.match(prompt, /interactive demo browsing \(automatic screenshot \+ vision inspection\) WAS performed/);
    assert.doesNotMatch(prompt, /image vision was not performed/);
    assert.doesNotMatch(prompt, /interactive demo browsing was not performed/);
  });
});

describe("judge topic concurrency", () => {
  it("runs queued work with no more than the requested concurrency", async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed.push(item);
      active -= 1;
    });

    assert.equal(peak, 3);
    assert.deepEqual([...completed].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
  });
});
