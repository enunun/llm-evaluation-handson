import { describe, expect, it } from "vitest";
import { ollamaLlm, type OllamaClient } from "../../src/ollamaLlm.ts";

describe("ollamaLlm", () => {
  it("モデル名とプロンプトをOllamaに渡し，生成された文字列を返す", async () => {
    const calls: unknown[] = [];
    const client: OllamaClient = {
      async generate(request) {
        calls.push(request);
        return { response: "refund" };
      },
    };
    const llm = ollamaLlm({ client, model: "qwen2.5:3b" });
    expect(await llm.complete({ prompt: "分類して" })).toBe("refund");
    expect(calls).toEqual([{ model: "qwen2.5:3b", prompt: "分類して", stream: false }]);
  });

  it("JSONの形式を求められたら，Ollamaにformat: jsonを渡す", async () => {
    const calls: unknown[] = [];
    const client: OllamaClient = {
      async generate(request) {
        calls.push(request);
        return { response: "{}" };
      },
    };
    await ollamaLlm({ client, model: "qwen2.5:3b" }).complete({
      prompt: "判定して",
      format: "json",
    });
    expect(calls).toEqual([
      { model: "qwen2.5:3b", prompt: "判定して", stream: false, format: "json" },
    ]);
  });
});
