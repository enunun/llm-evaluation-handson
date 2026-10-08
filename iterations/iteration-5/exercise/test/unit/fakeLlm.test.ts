import { describe, expect, it } from "vitest";
import { fakeJudgeLlm, keywordLlm, scriptedLlm, templateReplyLlm } from "../../src/fakeLlm.ts";
import { seededRandom } from "../../src/random.ts";

const inquiry = (text: string) =>
  `カテゴリを答えよ．返金や配送の例がある．\n<inquiry>\n${text}\n</inquiry>`;

describe("scriptedLlm", () => {
  it("決めた応答を順に返す", async () => {
    const llm = scriptedLlm(["refund", "shipping"]);
    expect(await llm.complete({ prompt: "a" })).toBe("refund");
    expect(await llm.complete({ prompt: "b" })).toBe("shipping");
  });

  it("受け取ったリクエストを記録する", async () => {
    const llm = scriptedLlm(["refund"]);
    await llm.complete({ prompt: "a" });
    expect(llm.requests).toEqual([{ prompt: "a" }]);
  });

  it("応答が尽きたらエラーにする", async () => {
    const llm = scriptedLlm([]);
    await expect(llm.complete({ prompt: "a" })).rejects.toThrow("no more responses");
  });
});

describe("keywordLlm", () => {
  const llm = keywordLlm({ random: seededRandom(1), noise: 0 });

  it("返金のキーワードを含む問い合わせをrefundに分類する", async () => {
    expect(await llm.complete({ prompt: inquiry("返品して返金してほしい") })).toBe("refund");
  });

  it("配送のキーワードを含む問い合わせをshippingに分類する", async () => {
    expect(await llm.complete({ prompt: inquiry("本がまだ届きません") })).toBe("shipping");
  });

  it("アカウントのキーワードを含む問い合わせをaccountに分類する", async () => {
    expect(await llm.complete({ prompt: inquiry("パスワードを忘れました") })).toBe("account");
  });

  it("どのキーワードも含まない問い合わせをotherに分類する", async () => {
    expect(await llm.complete({ prompt: inquiry("営業時間を教えてください") })).toBe("other");
  });

  it("複数のキーワードがあれば，最初に現れたものの分類にする", async () => {
    expect(
      await llm.complete({ prompt: inquiry("届いた商品が壊れていたので返金してほしい") }),
    ).toBe("shipping");
  });

  it("inquiryタグがなければエラーにする", async () => {
    await expect(llm.complete({ prompt: "返金" })).rejects.toThrow("<inquiry>");
  });
});

// 同じ問い合わせを，シードとnoiseを決めた偽LLMにcount回分類させる．
async function classifyMany(seed: number, noise: number, count: number): Promise<string[]> {
  const llm = keywordLlm({ random: seededRandom(seed), noise });
  const outputs: string[] = [];
  for (let i = 0; i < count; i++) {
    outputs.push(await llm.complete({ prompt: inquiry("返品して返金してほしい") }));
  }
  return outputs;
}

describe("keywordLlm の揺れ", () => {
  it("noiseが1なら，キーワードによる分類とは違う答えを返す", async () => {
    const outputs = await classifyMany(1, 1, 50);
    expect(outputs).not.toContain("refund");
  });

  it("noiseが1なら，カテゴリでない答えを返すこともある", async () => {
    const outputs = await classifyMany(1, 1, 50);
    expect(outputs).toContain("わかりません");
  });

  it("noiseの割合だけ，キーワードによる分類と違う答えを返す", async () => {
    const outputs = await classifyMany(1, 0.2, 1000);
    const wrong = outputs.filter((output) => output !== "refund").length;
    expect(wrong / 1000).toBeCloseTo(0.2, 1);
  });

  it("同じシードなら同じ答えの列を返す", async () => {
    expect(await classifyMany(3, 0.5, 20)).toEqual(await classifyMany(3, 0.5, 20));
  });
});

const replyPrompt = (text: string) =>
  `方針に従って返信を書け．\n<policy>\n返金は確認後に連絡する\n</policy>\n<inquiry>\n${text}\n</inquiry>`;

describe("templateReplyLlm", () => {
  it("問い合わせのカテゴリに合わせた，丁寧な返信の型を返す", async () => {
    const llm = templateReplyLlm({ random: seededRandom(1), noise: 0 });
    const reply = await llm.complete({ prompt: replyPrompt("本がまだ届きません") });
    expect(reply).toContain("発送");
    expect(reply).toContain("いたします");
  });

  it("noiseが1なら，方針にない約束，ぞんざいな言葉遣い，問い合わせに答えない内容のどれかを含む", async () => {
    const llm = templateReplyLlm({ random: seededRandom(1), noise: 1 });
    const replies = await Promise.all(
      Array.from({ length: 30 }, () =>
        llm.complete({ prompt: replyPrompt("返品して返金してほしい") }),
      ),
    );
    expect(replies.some((r) => r.includes("全額返金します"))).toBe(true);
    expect(replies.some((r) => !r.includes("いたします"))).toBe(true);
    expect(replies.some((r) => r.includes("セール"))).toBe(true);
  });
});

const judgePrompt = (reply: string) =>
  `ルーブリックに従って判定せよ．\n<reply>\n${reply}\n</reply>`;

describe("fakeJudgeLlm", () => {
  it("丁寧語を含む返信をpassと判定するJSONを返す", async () => {
    const llm = fakeJudgeLlm({ random: seededRandom(1), noise: 0 });
    const output = await llm.complete({ prompt: judgePrompt("確認のうえご連絡いたします．") });
    expect(JSON.parse(output)).toMatchObject({ verdict: "pass" });
  });

  it("丁寧語を含まない返信をfailと判定するJSONを返す", async () => {
    const llm = fakeJudgeLlm({ random: seededRandom(1), noise: 0 });
    const output = await llm.complete({ prompt: judgePrompt("無理．") });
    expect(JSON.parse(output)).toMatchObject({ verdict: "fail" });
  });

  it("noiseが1なら，逆の判定，unknown，JSONでない文のどれかを返す", async () => {
    const llm = fakeJudgeLlm({ random: seededRandom(1), noise: 1 });
    const outputs = await Promise.all(
      Array.from({ length: 30 }, () => llm.complete({ prompt: judgePrompt("ご連絡いたします．") })),
    );
    expect(outputs).toContain(JSON.stringify({ reason: "丁寧語がない", verdict: "fail" }));
    expect(outputs.some((o) => o.includes('"unknown"'))).toBe(true);
    expect(outputs.some((o) => !o.startsWith("{"))).toBe(true);
  });
});
