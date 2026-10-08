import { Ollama } from "ollama";
import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import { z } from "zod";
import { fakeJudgeLlm } from "./fakeLlm.ts";
import { judge } from "./judge.ts";
import type { Llm } from "./llm.ts";
import { ollamaLlm } from "./ollamaLlm.ts";
import { seededRandom, trialSeed } from "./random.ts";

// promptfooconfig.yamlのアサーションのconfig．
const configSchema = z.object({
  rubric: z.string(),
  judge: z.object({
    llm: z.enum(["fake", "ollama"]).default("fake"),
    model: z.string().default("qwen2.5:3b"),
    host: z.string().optional(),
    seed: z.int().min(1).default(1),
    noise: z.number().min(0).max(1).default(0),
  }),
});
type JudgeConfig = z.infer<typeof configSchema>["judge"];

// promptfooのカスタムアサーション．出力をJudgeに判定させる．
export default async function judgeAssertion(
  output: string,
  context: AssertionValueFunctionContext,
): Promise<GradingResult> {
  const config = configSchema.parse(context.config ?? {});
  const trial = Number(context.metadata?.trial ?? 0);
  return gradeWithJudge(
    judgeLlm(config.judge, `${config.rubric}\u0000${output}`, trial),
    config.rubric,
    output,
  );
}

// Judgeの判定を，promptfooの採点結果にする．unknownとerrorは不合格とし，判定をメタデータに残す．
export async function gradeWithJudge(
  llm: Llm,
  rubric: string,
  output: string,
): Promise<GradingResult> {
  let verdict;
  try {
    verdict = await judge(llm, rubric, output);
  } catch (error) {
    verdict = {
      outcome: "error" as const,
      reason: `judge error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const pass = verdict.outcome === "pass";
  return {
    pass,
    score: pass ? 1 : 0,
    reason: verdict.reason,
    metadata: { outcome: verdict.outcome },
  };
}

// 偽のJudgeは，ルーブリック，出力，試行の番号から決まる乱数で揺らす．
function judgeLlm(config: JudgeConfig, key: string, trial: number): Llm {
  if (config.llm === "fake") {
    return fakeJudgeLlm({
      random: seededRandom(trialSeed(config.seed, key, trial)),
      noise: config.noise,
    });
  }
  return ollamaLlm({
    client: new Ollama({
      host: config.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434",
    }),
    model: config.model,
  });
}
