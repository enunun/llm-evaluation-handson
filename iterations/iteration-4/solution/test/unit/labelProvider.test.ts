import type { CallApiContextParams } from "promptfoo";
import { describe, expect, it } from "vitest";
import LabelProvider from "../../src/labelProvider.ts";

const context = (vars: Record<string, string>, repeatIndex = 0): CallApiContextParams => ({
  prompt: { raw: "{{reply}}", label: "{{reply}}" },
  vars,
  repeatIndex,
});

describe("LabelProvider", () => {
  it("変数replyの返信をそのまま出力にする", async () => {
    const provider = new LabelProvider();
    expect((await provider.callApi("", context({ reply: "ご連絡いたします．" }))).output).toBe(
      "ご連絡いたします．",
    );
  });

  it("試行の番号をメタデータに記録する", async () => {
    const provider = new LabelProvider();
    expect((await provider.callApi("", context({ reply: "x" }, 3))).metadata).toEqual({ trial: 3 });
  });

  it("変数replyがなければエラーとして返す", async () => {
    const provider = new LabelProvider();
    expect((await provider.callApi("", context({}))).error).toBe("no reply in vars");
  });

  it("IDはlabelsである", () => {
    expect(new LabelProvider().id()).toBe("labels");
  });
});
