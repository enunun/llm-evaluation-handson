import type { Llm } from "./llm.ts";

export const categories = ["refund", "shipping", "account", "other"] as const;
export type Category = (typeof categories)[number];

// 問い合わせをLLMで4つのカテゴリのどれかに分類する．
// どのカテゴリにも当たらない出力は"invalid"にする．
export async function classifyInquiry(llm: Llm, inquiry: string): Promise<Category | "invalid"> {
  throw new Error("TODO: classifyInquiry");
}
