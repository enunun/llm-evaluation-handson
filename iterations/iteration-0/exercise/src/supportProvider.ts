import type { ApiProvider, ProviderOptions, ProviderResponse } from "promptfoo";

// promptfooのカスタムプロバイダ．promptfooが描画したプロンプト(問い合わせ文)を受け取り，
// 製品のclassifyInquiryを呼んで，分類したカテゴリを出力として返す．
export default class SupportProvider implements ApiProvider {
  constructor(options: ProviderOptions) {
    throw new Error("TODO: SupportProvider");
  }

  id(): string {
    throw new Error("TODO: SupportProvider.id");
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    throw new Error("TODO: SupportProvider.callApi");
  }
}
