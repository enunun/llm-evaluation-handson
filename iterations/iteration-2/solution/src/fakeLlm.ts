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
      const category = classifyByKeyword(extractInquiry(request.prompt));
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

function extractInquiry(prompt: string): string {
  const match = prompt.match(/<inquiry>([\s\S]*?)<\/inquiry>/);
  if (!match?.[1]) {
    throw new Error("keywordLlm: the prompt has no <inquiry> tag");
  }
  return match[1];
}
