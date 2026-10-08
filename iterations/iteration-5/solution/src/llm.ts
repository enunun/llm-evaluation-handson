// LLMのポート．製品はこのインタフェースだけに依存し，
// 本物のLLM(ollamaLlm)と偽物(fakeLlm)を差し替えられる．
export type LlmRequest = {
  prompt: string;
  // "json"なら，LLMにJSONだけを出力させる(Judgeが使う)．
  format?: "json";
};

export interface Llm {
  complete(request: LlmRequest): Promise<string>;
}
