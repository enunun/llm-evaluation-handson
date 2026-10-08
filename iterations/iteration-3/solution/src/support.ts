import type { Llm } from "./llm.ts";

export const categories = ["refund", "shipping", "account", "other"] as const;
export type Category = (typeof categories)[number];

// 分類のプロンプトの版．プロンプトを変えたら版を上げ，評価の記録と照らし合わせられるようにする．
export const classificationPromptVersion = "classify-v1";

// 返信の下書きのプロンプトの版．
export const replyPromptVersion = "reply-v1";

// 返信の下書きでLLMに与える，返金，配送，アカウントの方針．
export const supportPolicy = `- 返金：商品の到着から30日以内で，未使用の場合に受け付ける．返金の可否は，担当部署が確認してから連絡する．
- 配送：通常は注文から3営業日以内に発送する．配送状況は注文履歴から確認できる．
- アカウント：パスワードは，ログイン画面の「パスワードを忘れた方」から再設定できる．`;

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

// 方針に従って，問い合わせへの返信の下書きをLLMに書かせる．
export async function draftReply(llm: Llm, inquiry: string, policy: string): Promise<string> {
  const output = await llm.complete({ prompt: replyPrompt(inquiry, policy) });
  return output.trim();
}

function replyPrompt(inquiry: string, policy: string): string {
  return `あなたはカスタマーサポートの担当者です．
次の方針に従い，問い合わせへの返信を丁寧な日本語で書いてください．
方針に書かれていないことは約束しないでください．返信の本文だけを書いてください．

<policy>
${policy}
</policy>

<inquiry>
${inquiry}
</inquiry>`;
}
