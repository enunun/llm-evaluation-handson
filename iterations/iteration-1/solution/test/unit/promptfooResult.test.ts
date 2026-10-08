import { describe, expect, it } from "vitest";
import { parseResultFile } from "../../src/promptfooResult.ts";

const metric = "category (QC01-1)";

type Assertion = { type: string; metric?: string };

function result(
  description: string,
  output: string,
  pass: boolean,
  assertion: Assertion = { type: "equals", metric },
) {
  return {
    testCase: { description, assert: [assertion] },
    provider: { id: "support-fake", label: "" },
    response: { output },
    success: pass,
    gradingResult: {
      pass,
      componentResults: [{ pass, score: pass ? 1 : 0, assertion }],
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

  it("タスクと採点器ごとの合否と出力を取り出す", () => {
    const parsed = parseResultFile(
      file([result("refund-01", "refund", true), result("refund-02", "other", false)]),
    );
    expect(parsed.trials).toEqual([
      { taskId: "refund-01", grader: metric, output: "refund", pass: true },
      { taskId: "refund-02", grader: metric, output: "other", pass: false },
    ]);
  });

  it("metricのない採点器は，アサーションの種類を名前にする", () => {
    const raw = result("refund-01", "refund", true, { type: "equals" });
    expect(parseResultFile(file([raw])).trials[0]?.grader).toBe("equals");
  });

  it("プロバイダがエラーを返した試行は，そのタスクのすべての採点器を不合格にする", () => {
    const raw = {
      testCase: { description: "refund-01", assert: [{ type: "equals", metric }] },
      provider: { id: "support-ollama", label: "" },
      response: { error: "llm error: fetch failed" },
      success: false,
      error: "llm error: fetch failed",
      gradingResult: null,
    };
    expect(parseResultFile(file([raw])).trials).toEqual([
      { taskId: "refund-01", grader: metric, output: "", pass: false },
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
    const raw = { ...result("refund-01", "refund", true), metadata: { ...metadata, other: "x" } };
    expect(parseResultFile(file([raw])).metadata).toEqual(metadata);
  });

  it("メタデータがなければ，再現のための記録を空にする", () => {
    expect(parseResultFile(file([result("refund-01", "refund", true)])).metadata).toEqual({});
  });

  it("promptfooの結果JSONの形でなければエラーにする", () => {
    expect(() => parseResultFile(JSON.stringify({ results: [] }))).toThrow(
      "not a promptfoo result file",
    );
  });
});
