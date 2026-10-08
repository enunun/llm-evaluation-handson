import { describe, expect, it } from "vitest";
import SupportProvider from "../../src/supportProvider.ts";

describe("SupportProvider", () => {
  it("設定llm: fakeでは，偽LLMで分類したカテゴリを出力にする", async () => {
    const provider = new SupportProvider({ config: { llm: "fake" } });
    expect(await provider.callApi("本がまだ届きません")).toEqual({ output: "shipping" });
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
    const response = await provider.callApi("本がまだ届きません");
    expect(response.error).toMatch(/^llm error: /);
  });
});
