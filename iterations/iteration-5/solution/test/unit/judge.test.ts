import { describe, expect, it } from "vitest";
import { scriptedLlm } from "../../src/fakeLlm.ts";
import { judge } from "../../src/judge.ts";

const rubric = "返信が丁寧な言葉遣いで書かれているか．";

describe("judge", () => {
  it("Judgeがpassと答えたら，理由とともにpassを返す", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "敬語である", verdict: "pass" })]);
    expect(await judge(llm, rubric, "ご連絡いたします．")).toEqual({
      outcome: "pass",
      reason: "敬語である",
    });
  });

  it("Judgeがfailと答えたらfailを返す", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "命令口調", verdict: "fail" })]);
    expect((await judge(llm, rubric, "早くしろ．")).outcome).toBe("fail");
  });

  it("Judgeが判断できないと答えたらunknownを返す", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "返信が空", verdict: "unknown" })]);
    expect((await judge(llm, rubric, "")).outcome).toBe("unknown");
  });

  it("JSONとして読めない応答はerrorにする", async () => {
    const llm = scriptedLlm(["はい，丁寧です．"]);
    const verdict = await judge(llm, rubric, "ご連絡いたします．");
    expect(verdict.outcome).toBe("error");
    expect(verdict.reason).toContain("はい，丁寧です．");
  });

  it("verdictが決めた値でなければerrorにする", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "まあまあ", verdict: "maybe" })]);
    expect((await judge(llm, rubric, "ご連絡いたします．")).outcome).toBe("error");
  });

  it("プロンプトにルーブリックと，replyタグで囲んだ返信を含め，JSONの形式を求める", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "敬語", verdict: "pass" })]);
    await judge(llm, rubric, "ご連絡いたします．");
    expect(llm.requests[0]?.prompt).toContain(rubric);
    expect(llm.requests[0]?.prompt).toContain("<reply>\nご連絡いたします．\n</reply>");
    expect(llm.requests[0]?.format).toBe("json");
  });
});
