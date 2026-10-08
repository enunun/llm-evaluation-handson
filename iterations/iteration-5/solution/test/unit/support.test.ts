import { describe, expect, it } from "vitest";
import { scriptedLlm } from "../../src/fakeLlm.ts";
import { classifyInquiry, draftReply } from "../../src/support.ts";

describe("classifyInquiry", () => {
  it("LLMが答えたカテゴリを返す", async () => {
    expect(await classifyInquiry(scriptedLlm(["refund"]), "返金して")).toBe("refund");
  });

  it("前後の空白を取り除く", async () => {
    expect(await classifyInquiry(scriptedLlm([" shipping\n"]), "届かない")).toBe("shipping");
  });

  it("大文字と小文字を区別しない", async () => {
    expect(await classifyInquiry(scriptedLlm(["Account"]), "ログインできない")).toBe("account");
  });

  it("4つのカテゴリのどれでもない出力はinvalidにする", async () => {
    expect(await classifyInquiry(scriptedLlm(["返金"]), "返金して")).toBe("invalid");
  });

  it("プロンプトに問い合わせ文をinquiryタグで囲んで含める", async () => {
    const llm = scriptedLlm(["other"]);
    await classifyInquiry(llm, "営業時間は？");
    expect(llm.requests[0]?.prompt).toContain("<inquiry>\n営業時間は？\n</inquiry>");
  });
});

describe("draftReply", () => {
  it("LLMが書いた返信を，前後の空白を除いて返す", async () => {
    expect(
      await draftReply(scriptedLlm(["\nお問い合わせありがとうございます．\n"]), "届かない", "方針"),
    ).toBe("お問い合わせありがとうございます．");
  });

  it("プロンプトに，方針をpolicyタグで，問い合わせ文をinquiryタグで囲んで含める", async () => {
    const llm = scriptedLlm(["返信"]);
    await draftReply(llm, "本が届かない", "3営業日以内に発送する");
    const prompt = llm.requests[0]?.prompt ?? "";
    expect(prompt).toContain("<policy>\n3営業日以内に発送する\n</policy>");
    expect(prompt).toContain("<inquiry>\n本が届かない\n</inquiry>");
  });
});
