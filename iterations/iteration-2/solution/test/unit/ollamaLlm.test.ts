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
});
