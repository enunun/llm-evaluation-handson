import type { CallApiContextParams } from "promptfoo";
import { describe, expect, it } from "vitest";
import SupportProvider from "../../src/supportProvider.ts";

// promptfooがcallApiに渡す文脈のうち，プロバイダが使う試行の番号だけを持つもの．
const trial = (repeatIndex: number): CallApiContextParams => ({
  prompt: { raw: "{{inquiry}}", label: "{{inquiry}}" },
  vars: {},
  repeatIndex,
});

describe("SupportProvider", () => {
  it("設定llm: fakeでは，偽LLMで分類したカテゴリを出力にする", async () => {
    const provider = new SupportProvider({ config: { llm: "fake" } });
    expect(await provider.callApi("本がまだ届きません", trial(0))).toMatchObject({
      output: "shipping",
    });
  });

  it("出力のメタデータに，LLMの種類，モデル名，プロンプトの版，シードを記録する", async () => {
    const provider = new SupportProvider({ config: { llm: "fake", seed: 7 } });
    const response = await provider.callApi("本がまだ届きません", trial(0));
    expect(response.metadata).toEqual({
      llm: "fake",
      model: "keyword",
      promptVersion: "classify-v1",
      seed: 7,
    });
  });

  it("Ollamaを使うときは，使わないシードを記録しない", async () => {
    const provider = new SupportProvider({
      config: { llm: "ollama", host: "http://127.0.0.1:9", model: "qwen2.5:0.5b", seed: 7 },
    });
    const response = await provider.callApi("本がまだ届きません", trial(0));
    expect(response.metadata).toEqual({
      llm: "ollama",
      model: "qwen2.5:0.5b",
      promptVersion: "classify-v1",
    });
  });

  it("同じシード，問い合わせ，試行の番号なら，同じ出力を返す", async () => {
    const first = new SupportProvider({ config: { llm: "fake", seed: 1, noise: 0.5 } });
    const second = new SupportProvider({ config: { llm: "fake", seed: 1, noise: 0.5 } });
    for (let index = 0; index < 10; index++) {
      expect((await first.callApi("本がまだ届きません", trial(index))).output).toBe(
        (await second.callApi("本がまだ届きません", trial(index))).output,
      );
    }
  });

  it("呼び出しの順序が違っても，試行の番号ごとの出力は変わらない", async () => {
    const provider = new SupportProvider({ config: { llm: "fake", seed: 1, noise: 0.5 } });
    const forward: unknown[] = [];
    for (let index = 0; index < 10; index++) {
      forward.push((await provider.callApi("本がまだ届きません", trial(index))).output);
    }
    const backward: unknown[] = [];
    for (let index = 9; index >= 0; index--) {
      backward.unshift((await provider.callApi("本がまだ届きません", trial(index))).output);
    }
    expect(backward).toEqual(forward);
  });

  it("noiseがあれば，試行によって出力が変わる", async () => {
    const provider = new SupportProvider({ config: { llm: "fake", seed: 1, noise: 0.5 } });
    const outputs = new Set<unknown>();
    for (let index = 0; index < 20; index++) {
      outputs.add((await provider.callApi("本がまだ届きません", trial(index))).output);
    }
    expect(outputs.size).toBeGreaterThan(1);
  });

  it("IDはsupport-<llm>である", () => {
    expect(new SupportProvider({ config: { llm: "fake" } }).id()).toBe("support-fake");
  });

  it("未知のllmの設定はエラーにする", () => {
    expect(() => new SupportProvider({ config: { llm: "gpt" } })).toThrow("unknown llm: gpt");
  });

  it("LLMの呼び出しが失敗したら，promptfooにエラーとして返す", async () => {
    const provider = new SupportProvider({
      config: { llm: "ollama", host: "http://127.0.0.1:9", model: "qwen2.5:3b" },
    });
    const response = await provider.callApi("本がまだ届きません", trial(0));
    expect(response.error).toMatch(/^llm error: /);
  });
});
