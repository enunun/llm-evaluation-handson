# Iteration 3 解答：自由記述を3種類の採点器で評価する

返信の下書きを書く`draftReply`，LLM Judgeと意思決定モデルのカスタムアサーション，`unknown`と`error`を区別して数え，トランスクリプトを表示する`evalstats`の完成形である．
演習の手順ごとの解説は[docs/iteration-3.md](docs/iteration-3.md)にある．

## 動かし方

```console
pnpm test
pnpm eval --repeat 10 -o results/fake.json
pnpm evalstats summary results/fake.json
pnpm evalstats show results/fake.json reply-02
```

Ollamaで評価するときは，`promptfooconfig.yaml`のプロバイダの`llm`，Judgeの`judge.llm`，意思決定モデルの`model.llm`を`ollama`に変える．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-3.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク，返信の4タスク)
src/                    製品，プロバイダ，採点器，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONの置き場所
```
