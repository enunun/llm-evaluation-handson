import { describe, expect, it } from "vitest";
import { parseResultFile } from "../../src/promptfooResult.ts";

const metric = "category (QC01-1)";

type Assertion = { type: string; metric?: string };
type Component = {
  pass: boolean;
  score: number;
  reason?: string;
  assertion: Assertion;
  metadata?: Record<string, unknown>;
};

function result(
  description: string,
  output: string,
  pass: boolean,
  assertion: Assertion = { type: "equals", metric },
  component: Partial<Component> = {},
) {
  return {
    testCase: { description, assert: [assertion] },
    provider: { id: "support-fake", label: "" },
    response: { output },
    success: pass,
    gradingResult: {
      pass,
      componentResults: [{ pass, score: pass ? 1 : 0, assertion, ...component }],
    },
  };
}

function file(results: unknown[]) {
  return JSON.stringify({ config: { description: "support" }, results: { results } });
}

describe("parseResultFile", () => {
  it("スイート名とプロバイダ名を取り出す", () => {
    const parsed = parseResultFile(file([result("refund-01", "refund", true)]));
    expect(parsed.suite).toBe("support");
    expect(parsed.provider).toBe("support-fake");
  });

  it("試行と採点器ごとに，出力，採点の結果，理由を取り出す", () => {
    const parsed = parseResultFile(
      file([
        result("refund-01", "refund", true, undefined, { reason: "Assertion passed" }),
        result("refund-02", "other", false, undefined, { reason: "Expected refund" }),
      ]),
    );
    expect(parsed.trials).toEqual([
      {
        taskId: "refund-01",
        trial: 1,
        grader: metric,
        output: "refund",
        outcome: "pass",
        reason: "Assertion passed",
      },
      {
        taskId: "refund-02",
        trial: 1,
        grader: metric,
        output: "other",
        outcome: "fail",
        reason: "Expected refund",
      },
    ]);
  });

  it("同じタスクの試行に，現れた順に1からの番号を付ける", () => {
    const parsed = parseResultFile(
      file([result("a", "x", true), result("b", "x", true), result("a", "y", false)]),
    );
    expect(parsed.trials.map((t) => [t.taskId, t.trial])).toEqual([
      ["a", 1],
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("アサーションのメタデータにあるunknownとerrorを，採点の結果として取り出す", () => {
    const judge = { type: "javascript", metric: "judge:polite (QC01-4)" };
    const parsed = parseResultFile(
      file([
        result("reply-01", "返信", false, judge, { metadata: { outcome: "unknown" } }),
        result("reply-01", "返信", false, judge, { metadata: { outcome: "error" } }),
      ]),
    );
    expect(parsed.trials.map((t) => t.outcome)).toEqual(["unknown", "error"]);
  });

  it("metricのない採点器は，アサーションの種類を名前にする", () => {
    const raw = result("refund-01", "refund", true, { type: "equals" });
    expect(parseResultFile(file([raw])).trials[0]?.grader).toBe("equals");
  });

  it("プロバイダがエラーを返した試行は，そのタスクのすべての採点器をerrorにする", () => {
    const raw = {
      testCase: { description: "refund-01", assert: [{ type: "equals", metric }] },
      provider: { id: "support-ollama", label: "" },
      response: { error: "llm error: fetch failed" },
      success: false,
      error: "llm error: fetch failed",
      gradingResult: null,
    };
    expect(parseResultFile(file([raw])).trials).toEqual([
      {
        taskId: "refund-01",
        trial: 1,
        grader: metric,
        output: "",
        outcome: "error",
        reason: "llm error: fetch failed",
      },
    ]);
  });

  it("プロバイダのラベルがあれば，IDの代わりにラベルを使う", () => {
    const raw = {
      ...result("refund-01", "refund", true),
      provider: { id: "file://x", label: "mine" },
    };
    expect(parseResultFile(file([raw])).provider).toBe("mine");
  });

  it("最初の結果のメタデータから，再現のための記録を取り出す", () => {
    const metadata = { llm: "fake", model: "keyword", promptVersion: "classify-v1", seed: 1 };
    const raw = { ...result("refund-01", "refund", true), metadata: { ...metadata, trial: 0 } };
    expect(parseResultFile(file([raw])).metadata).toEqual(metadata);
  });

  it("結果ごとに違う記録は，現れた順に重複を除いてカンマでつなぐ", () => {
    const classify = { llm: "fake", model: "keyword", promptVersion: "classify-v1", seed: 1 };
    const reply = { llm: "fake", model: "template", promptVersion: "reply-v1", seed: 1 };
    const raws = [classify, reply, classify].map((metadata) => ({
      ...result("refund-01", "refund", true),
      metadata,
    }));
    expect(parseResultFile(file(raws)).metadata).toEqual({
      llm: "fake",
      model: "keyword, template",
      promptVersion: "classify-v1, reply-v1",
      seed: 1,
    });
  });

  it("メタデータがなければ，再現のための記録を空にする", () => {
    expect(parseResultFile(file([result("refund-01", "refund", true)])).metadata).toEqual({});
  });

  it("アサーションのメタデータにある確率を，試行に残す", () => {
    const decision = { type: "javascript", metric: "decision:answers (QC01-1)" };
    const raw = result("reply-01", "返信", true, decision, {
      metadata: { outcome: "pass", probability: 0.8 },
    });
    expect(parseResultFile(file([raw])).trials[0]?.probability).toBe(0.8);
  });

  it("テストのメタデータにある人の判定と分割を，タスクのラベルとして取り出す", () => {
    const raw = result("label-01", "返信", true);
    const labeled = {
      ...raw,
      testCase: { ...raw.testCase, metadata: { split: "dev", human: { [metric]: "fail" } } },
    };
    expect(parseResultFile(file([labeled, labeled])).labels).toEqual([
      { taskId: "label-01", split: "dev", human: { [metric]: "fail" } },
    ]);
  });

  it("人の判定のないタスクはラベルに含めない", () => {
    expect(parseResultFile(file([result("refund-01", "refund", true)])).labels).toEqual([]);
  });

  it("採点器ごとの設定を，アサーションの種類，値，設定から取り出す", () => {
    const judge = {
      type: "javascript",
      value: "file://src/judgeAssertion.ts",
      metric: "judge:polite (QC01-4)",
      config: { rubric: "丁寧か" },
    };
    const parsed = parseResultFile(file([result("reply-01", "返信", true, judge)]));
    expect(parsed.graderSettings).toEqual({
      "judge:polite (QC01-4)": JSON.stringify({
        type: "javascript",
        value: "file://src/judgeAssertion.ts",
        config: { rubric: "丁寧か" },
      }),
    });
  });

  it("promptfooの結果JSONの形でなければエラーにする", () => {
    expect(() => parseResultFile(JSON.stringify({ results: [] }))).toThrow(
      "not a promptfoo result file",
    );
  });
});
