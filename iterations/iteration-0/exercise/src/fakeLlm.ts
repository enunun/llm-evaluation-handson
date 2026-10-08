import type { Llm, LlmRequest } from "./llm.ts";

// 決めた応答を順に返す偽LLM．単体テストで使う．
export function scriptedLlm(responses: string[]): Llm & { requests: LlmRequest[] } {
  throw new Error("TODO: scriptedLlm");
}

// 問い合わせ文に最初に現れたキーワードで分類する偽LLM．
// promptfooでOllamaの代わりに使う．
export function keywordLlm(): Llm {
  throw new Error("TODO: keywordLlm");
}
