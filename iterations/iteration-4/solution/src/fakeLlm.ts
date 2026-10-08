import type { Llm, LlmRequest } from "./llm.ts";
import type { Random } from "./random.ts";

// 決めた応答を順に返す偽LLM．単体テストで使う．
export function scriptedLlm(responses: string[]): Llm & { requests: LlmRequest[] } {
  const remaining = [...responses];
  const requests: LlmRequest[] = [];
  return {
    requests,
    async complete(request) {
      requests.push(request);
      const response = remaining.shift();
      if (response === undefined) {
        throw new Error("scriptedLlm: no more responses");
      }
      return response;
    },
  };
}

const keywords: { category: string; words: string[] }[] = [
  { category: "refund", words: ["返金", "返品", "払い戻"] },
  { category: "shipping", words: ["届", "配送", "発送", "配達"] },
  { category: "account", words: ["ログイン", "パスワード", "アカウント", "メールアドレス"] },
];

// 問い合わせ文に最初に現れたキーワードで分類する偽LLM．
// promptfooでOllamaの代わりに使う．確率noiseで，キーワードによる分類とは違う答えを返す．
export function keywordLlm(options: { random: Random; noise: number }): Llm {
  return {
    async complete(request) {
      const category = classifyByKeyword(extractTag(request.prompt, "inquiry"));
      if (options.random.next() >= options.noise) {
        return category;
      }
      const alternatives = [...categories.filter((c) => c !== category), "わかりません"];
      return alternatives[Math.floor(options.random.next() * alternatives.length)] ?? category;
    },
  };
}

const categories = ["refund", "shipping", "account", "other"];

function classifyByKeyword(inquiry: string): string {
  let best: { category: string; index: number } = { category: "other", index: Infinity };
  for (const { category, words } of keywords) {
    for (const word of words) {
      const index = inquiry.indexOf(word);
      if (index !== -1 && index < best.index) {
        best = { category, index };
      }
    }
  }
  return best.category;
}

const replies: Record<string, string> = {
  refund:
    "お問い合わせいただきありがとうございます．返金のご希望を承りました．商品の到着から30日以内で未使用の場合，担当部署が確認のうえご連絡いたします．",
  shipping:
    "お問い合わせいただきありがとうございます．ご注文の商品は，通常3営業日以内に発送いたします．配送状況は注文履歴からご確認いただけます．",
  account:
    "お問い合わせいただきありがとうございます．パスワードは，ログイン画面の「パスワードを忘れた方」から再設定いただけます．",
  other: "お問い合わせいただきありがとうございます．担当者が確認のうえ，改めてご連絡いたします．",
};

// 返信の型に，確率noiseで3種類の欠陥のどれかを入れる．
const defects: ((reply: string) => string)[] = [
  (reply) => `${reply}全額返金します．`,
  () => "確認しとく．あとで連絡する．",
  () => "ただいま新商品のセールを実施中です．ぜひご覧ください．",
];

// 問い合わせのカテゴリに合わせた返信の型を返す偽LLM．
// promptfooでOllamaの代わりに返信を書く．確率noiseで，返信に欠陥を入れる．
export function templateReplyLlm(options: { random: Random; noise: number }): Llm {
  return {
    async complete(request) {
      const reply = replies[classifyByKeyword(extractTag(request.prompt, "inquiry"))] ?? "";
      if (options.random.next() >= options.noise) {
        return reply;
      }
      const defect = defects[Math.floor(options.random.next() * defects.length)];
      return defect ? defect(reply) : reply;
    },
  };
}

const politeWords = ["いたします", "ございます", "いただき"];

// 丁寧語の有無で判定し，JudgeのJSONを返す偽LLM．
// 確率noiseで，逆の判定，unknown，JSONでない文のどれかを返す．
export function fakeJudgeLlm(options: { random: Random; noise: number }): Llm {
  return {
    async complete(request) {
      const reply = extractTag(request.prompt, "reply");
      const polite = politeWords.some((word) => reply.includes(word));
      const pass = { reason: "丁寧語がある", verdict: "pass" };
      const fail = { reason: "丁寧語がない", verdict: "fail" };
      if (options.random.next() >= options.noise) {
        return JSON.stringify(polite ? pass : fail);
      }
      const mistakes = [
        JSON.stringify(polite ? fail : pass),
        JSON.stringify({ reason: "判断できない", verdict: "unknown" }),
        "はい，丁寧です．",
      ];
      return mistakes[Math.floor(options.random.next() * mistakes.length)] ?? "";
    },
  };
}

// プロンプトから<tag>と</tag>の間を取り出す．
function extractTag(prompt: string, tag: string): string {
  const match = prompt.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match?.[1]) {
    throw new Error(`fakeLlm: the prompt has no <${tag}> tag`);
  }
  return match[1];
}
