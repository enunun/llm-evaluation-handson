import type { Llm } from "./llm.ts";

// ollamaパッケージのOllamaクラスのうち，このアダプタが使う部分．
export type OllamaClient = {
  generate(request: {
    model: string;
    prompt: string;
    stream: false;
  }): Promise<{ response: string }>;
};

export function ollamaLlm(options: { client: OllamaClient; model: string }): Llm {
  return {
    async complete(request) {
      const response = await options.client.generate({
        model: options.model,
        prompt: request.prompt,
        stream: false,
      });
      return response.response;
    },
  };
}
