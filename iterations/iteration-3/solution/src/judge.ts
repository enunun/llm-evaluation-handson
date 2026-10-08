import { z } from "zod";
import type { Llm } from "./llm.ts";

// Judgeの判定．unknownはJudgeが判断できないと答えたこと，errorは応答を読めなかったことを表す．
export type JudgeVerdict = {
  outcome: "pass" | "fail" | "unknown" | "error";
  reason: string;
};

const responseSchema = z.object({
  reason: z.string(),
  verdict: z.enum(["pass", "fail", "unknown"]),
});

// 1つの観点のルーブリックで，出力をJudge用のLLMに判定させる．
export async function judge(llm: Llm, rubric: string, output: string): Promise<JudgeVerdict> {
  const response = await llm.complete({ prompt: judgePrompt(rubric, output), format: "json" });
  let parsed;
  try {
    parsed = responseSchema.safeParse(JSON.parse(response));
  } catch {
    return { outcome: "error", reason: `unparseable judge response: ${response}` };
  }
  if (!parsed.success) {
    return { outcome: "error", reason: `unexpected judge response: ${response}` };
  }
  return { outcome: parsed.data.verdict, reason: parsed.data.reason };
}

function judgePrompt(rubric: string, output: string): string {
  return `あなたはカスタマーサポートの返信を評価する担当者です．
次の観点だけで，返信を判定してください．

観点：${rubric}

観点を満たしていればpass，満たしていなければfailとします．
判断に必要な情報が足りなければunknownとします．
まず判断の理由をreasonに書き，最後にverdictを書いてください．
次の形のJSONだけを出力してください．
{"reason": "判断の理由", "verdict": "pass" | "fail" | "unknown"}

<reply>
${output}
</reply>`;
}
