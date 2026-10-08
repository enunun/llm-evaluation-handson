import { z } from "zod";
import type { Random } from "./random.ts";

// 意思決定モデルのポート．状態(判定の材料)と，はい/いいえで答える質問を渡し，「はい」の確率を受け取る．
export interface DecisionModel {
  noul(state: string, instructions: string): Promise<number>;
}

const responseSchema = z.object({
  answers: z.object({ decision: z.object({ noul: z.number() }) }),
});

// ollamaDecisionModelが使うfetchの形．テストでは偽物を渡す．
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

// Ollamaの/v1/systemoneを呼ぶ意思決定モデル(Tev1など)．
export function ollamaDecisionModel(options: {
  host: string;
  model: string;
  fetch?: Fetch;
}): DecisionModel {
  const fetchFn = options.fetch ?? fetch;
  return {
    async noul(state, instructions) {
      const response = await fetchFn(`${options.host}/v1/systemone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          state,
          questions: { decision: { type: "noul", instructions } },
        }),
      });
      if (!response.ok) {
        throw new Error(`decision model error: ${response.status} ${await response.text()}`);
      }
      return responseSchema.parse(await response.json()).answers.decision.noul;
    },
  };
}

// 返信が宣伝だけなら低い確率，それ以外は高い確率を返す偽の意思決定モデル．
// 確率は，noiseの幅で上下に揺れる．
export function fakeDecisionModel(options: { random: Random; noise: number }): DecisionModel {
  return {
    async noul(state) {
      const base = state.includes("セール") ? 0.1 : 0.9;
      const jitter = (options.random.next() * 2 - 1) * options.noise;
      return Math.min(1, Math.max(0, base + jitter));
    },
  };
}
