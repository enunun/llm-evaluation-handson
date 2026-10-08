import type { Llm } from "./llm.ts";

export const categories = ["refund", "shipping", "account", "other"] as const;
export type Category = (typeof categories)[number];

// 分類のプロンプトの版．プロンプトを変えたら版を上げ，評価の記録と照らし合わせられるようにする．
export const classificationPromptVersion = "classify-v1";

// 問い合わせをLLMで4つのカテゴリのどれかに分類する．
// どのカテゴリにも当たらない出力は"invalid"にする．
export async function classifyInquiry(llm: Llm, inquiry: string): Promise<Category | "invalid"> {
  const output = await llm.complete({ prompt: classificationPrompt(inquiry) });
  const normalized = output.trim().toLowerCase();
  return isCategory(normalized) ? normalized : "invalid";
}

function isCategory(value: string): value is Category {
  return (categories as readonly string[]).includes(value);
}

function classificationPrompt(inquiry: string): string {
  return `あなたはカスタマーサポートの担当者です．
次の問い合わせを，refund，shipping，account，otherのどれか1つに分類してください．
答えはカテゴリ名だけを1語で書いてください．

- refund：返金，返品，請求の誤り
- shipping：配送，発送，届け先
- account：ログイン，パスワード，登録情報
- other：上のどれにも当たらないもの

<inquiry>
${inquiry}
</inquiry>`;
}
