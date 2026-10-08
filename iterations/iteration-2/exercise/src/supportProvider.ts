import { Ollama } from "ollama";
import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from "promptfoo";
import { z } from "zod";
import { keywordLlm } from "./fakeLlm.ts";
import type { Llm } from "./llm.ts";
import { ollamaLlm } from "./ollamaLlm.ts";
import { seededRandom, trialSeed } from "./random.ts";
import { classificationPromptVersion, classifyInquiry } from "./support.ts";

// promptfooconfig.yamlのproviders[].config．
const configSchema = z.object({
  llm: z.string().default("fake"),
  model: z.string().default("qwen2.5:3b"),
  host: z.string().optional(),
  seed: z.int().min(1).default(1),
  noise: z.number().min(0).max(1).default(0),
});
type SupportConfig = z.infer<typeof configSchema>;

// promptfooのカスタムプロバイダ．promptfooが描画したプロンプト(問い合わせ文)を受け取り，
// 製品のclassifyInquiryを呼んで，分類したカテゴリを出力として返す．
export default class SupportProvider implements ApiProvider {
  private readonly settings: SupportConfig;
  private readonly ollama: Llm | undefined;

  constructor(options: ProviderOptions) {
    this.settings = configSchema.parse(options.config ?? {});
    if (this.settings.llm === "ollama") {
      this.ollama = ollamaLlm({
        client: new Ollama({
          host: this.settings.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434",
        }),
        model: this.settings.model,
      });
    } else if (this.settings.llm !== "fake") {
      throw new Error(`unknown llm: ${this.settings.llm}`);
    }
  }

  id(): string {
    return `support-${this.settings.llm}`;
  }

  async callApi(prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    // 結果を再現するための記録．シードは偽LLMだけが使う．
    const metadata = this.ollama
      ? { llm: "ollama", model: this.settings.model, promptVersion: classificationPromptVersion }
      : {
          llm: "fake",
          model: "keyword",
          promptVersion: classificationPromptVersion,
          seed: this.settings.seed,
        };
    try {
      const llm = this.ollama ?? this.fakeLlm(prompt, context?.repeatIndex ?? 0);
      return { output: await classifyInquiry(llm, prompt), metadata };
    } catch (error) {
      return {
        error: `llm error: ${error instanceof Error ? error.message : String(error)}`,
        metadata,
      };
    }
  }

  // 試行ごとに，シード，問い合わせ文，試行の番号から決まる乱数で偽LLMを作る．
  private fakeLlm(prompt: string, repeatIndex: number): Llm {
    const random = seededRandom(trialSeed(this.settings.seed, prompt, repeatIndex));
    return keywordLlm({ random, noise: this.settings.noise });
  }
}
