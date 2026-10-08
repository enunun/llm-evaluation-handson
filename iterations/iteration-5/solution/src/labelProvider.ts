import type { ApiProvider, CallApiContextParams, ProviderResponse } from "promptfoo";

// 人手ラベルのスイートで使うpromptfooのカスタムプロバイダ．
// テストの変数replyの返信をそのまま出力にし，採点器だけを動かす．
export default class LabelProvider implements ApiProvider {
  id(): string {
    return "labels";
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const reply = context?.vars.reply;
    if (typeof reply !== "string") {
      return { error: "no reply in vars" };
    }
    // 試行の番号は，偽の採点器が試行ごとに揺れるために使う．
    return { output: reply, metadata: { trial: context?.repeatIndex ?? 0 } };
  }
}
