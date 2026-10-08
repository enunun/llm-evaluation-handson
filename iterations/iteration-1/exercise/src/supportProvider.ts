import { Ollama } from "ollama";
import type { ApiProvider, ProviderOptions, ProviderResponse } from "promptfoo";
import { keywordLlm } from "./fakeLlm.ts";
import type { Llm } from "./llm.ts";
import { ollamaLlm } from "./ollamaLlm.ts";
import { classifyInquiry } from "./support.ts";
import { z } from "zod";

// promptfooconfig.yamlのproviders[].config．
const configSchema = z.object({
  llm: z.string().default("fake"),
  model: z.string().default("qwen2.5:3b"),
  host: z.string().optional(),
});
type SupportConfig = z.infer<typeof configSchema>;

// promptfooのカスタムプロバイダ．promptfooが描画したプロンプト(問い合わせ文)を受け取り，
// 製品のclassifyInquiryを呼んで，分類したカテゴリを出力として返す．
export default class SupportProvider implements ApiProvider {
  private readonly llmName: string;
  private readonly llm: Llm;

  constructor(options: ProviderOptions) {
    const config = configSchema.parse(options.config ?? {});
    this.llmName = config.llm;
    this.llm = createLlm(config);
  }

  id(): string {
    return `support-${this.llmName}`;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    try {
      return { output: await classifyInquiry(this.llm, prompt) };
    } catch (error) {
      return { error: `llm error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

function createLlm(config: SupportConfig): Llm {
  switch (config.llm) {
    case "fake":
      return keywordLlm();
    case "ollama":
      return ollamaLlm({
        client: new Ollama({
          host: config.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434",
        }),
        model: config.model,
      });
    default:
      throw new Error(`unknown llm: ${config.llm}`);
  }
}
