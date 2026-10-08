import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import { z } from "zod";
import { fakeDecisionModel, ollamaDecisionModel, type DecisionModel } from "./decisionModel.ts";
import { seededRandom, trialSeed } from "./random.ts";

// promptfooconfig.yamlのアサーションのconfig．
const configSchema = z.object({
  instructions: z.string(),
  threshold: z.number().min(0).max(1).default(0.5),
  model: z.object({
    llm: z.enum(["fake", "ollama"]).default("fake"),
    model: z.string().default("tev1"),
    host: z.string().optional(),
    seed: z.int().min(1).default(1),
    noise: z.number().min(0).max(1).default(0),
  }),
});
type ModelConfig = z.infer<typeof configSchema>["model"];

// promptfooのカスタムアサーション．問い合わせ文と出力を状態として意思決定モデルに渡し，
// 質問に「はい」と答える確率がしきい値以上なら合格にする．
export default async function decisionAssertion(
  output: string,
  context: AssertionValueFunctionContext,
): Promise<GradingResult> {
  const config = configSchema.parse(context.config ?? {});
  const inquiry = typeof context.vars.inquiry === "string" ? context.vars.inquiry : "";
  const state = `問い合わせ：${inquiry}\n返信：${output}`;
  const trial = Number(context.metadata?.trial ?? 0);
  const model = decisionModel(config.model, `${config.instructions}\u0000${state}`, trial);
  return gradeWithDecisionModel(model, config.instructions, state, config.threshold);
}

export async function gradeWithDecisionModel(
  model: DecisionModel,
  instructions: string,
  state: string,
  threshold: number,
): Promise<GradingResult> {
  let probability;
  try {
    probability = await model.noul(state, instructions);
  } catch (error) {
    const reason = `decision model error: ${error instanceof Error ? error.message : String(error)}`;
    return { pass: false, score: 0, reason, metadata: { outcome: "error" } };
  }
  const pass = probability >= threshold;
  return {
    pass,
    score: probability,
    reason: `probability ${probability.toFixed(2)} ${pass ? ">=" : "<"} threshold ${threshold.toFixed(2)}`,
    metadata: { outcome: pass ? "pass" : "fail", probability },
  };
}

// 偽の意思決定モデルは，質問，状態，試行の番号から決まる乱数で揺らす．
function decisionModel(config: ModelConfig, key: string, trial: number): DecisionModel {
  if (config.llm === "fake") {
    return fakeDecisionModel({
      random: seededRandom(trialSeed(config.seed, key, trial)),
      noise: config.noise,
    });
  }
  return ollamaDecisionModel({
    host: config.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434",
    model: config.model,
  });
}
