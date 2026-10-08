import { Ollama } from "ollama";
import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from "promptfoo";
import { z } from "zod";
import { keywordLlm, templateReplyLlm } from "./fakeLlm.ts";
import type { Llm } from "./llm.ts";
import { ollamaLlm } from "./ollamaLlm.ts";
import { seededRandom, trialSeed, type Random } from "./random.ts";
import {
  classificationPromptVersion,
  classifyInquiry,
  draftReply,
  replyPromptVersion,
  supportPolicy,
} from "./support.ts";

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
// テストの変数taskに応じて製品のclassifyInquiryかdraftReplyを呼び，その結果を出力として返す．
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
    const task = typeof context?.vars.task === "string" ? context.vars.task : "classify";
    const trial = context?.repeatIndex ?? 0;
    const product = products[task];
    if (product === undefined) {
      return { error: `unknown task: ${task}` };
    }
    // 結果を再現するための記録．シードは偽LLMだけが使う．試行の番号はアサーションが使う．
    const metadata = this.ollama
      ? { llm: "ollama", model: this.settings.model, promptVersion: product.promptVersion, trial }
      : {
          llm: "fake",
          model: product.fakeModel,
          promptVersion: product.promptVersion,
          seed: this.settings.seed,
          trial,
        };
    try {
      const random = seededRandom(trialSeed(this.settings.seed, prompt, trial));
      const llm = this.ollama ?? product.fakeLlm({ random, noise: this.settings.noise });
      return { output: await product.run(llm, prompt), metadata };
    } catch (error) {
      return {
        error: `llm error: ${error instanceof Error ? error.message : String(error)}`,
        metadata,
      };
    }
  }
}

// 変数taskで呼び分ける製品の機能．偽LLMは，試行ごとに決まる乱数で組み立てる．
type Product = {
  run(llm: Llm, inquiry: string): Promise<string>;
  promptVersion: string;
  fakeModel: string;
  fakeLlm(options: { random: Random; noise: number }): Llm;
};

const products: Record<string, Product> = {
  classify: {
    run: (llm, inquiry) => classifyInquiry(llm, inquiry),
    promptVersion: classificationPromptVersion,
    fakeModel: "keyword",
    fakeLlm: keywordLlm,
  },
  reply: {
    run: (llm, inquiry) => draftReply(llm, inquiry, supportPolicy),
    promptVersion: replyPromptVersion,
    fakeModel: "template",
    fakeLlm: templateReplyLlm,
  },
};
