# Iteration 1 解答：複数回試行する

各タスクを複数回試行し，タスクごとの合格率と揺れの状態，採点器ごとのpass@1とpass^kを表示する`evalstats`と，シード付きの揺れを持つ偽LLMの完成形である．
演習の手順ごとの解説は[docs/iteration-1.md](docs/iteration-1.md)にある．

## 動かし方

```console
pnpm test
pnpm eval --repeat 10 -o results/fake.json
pnpm evalstats summary results/fake.json
```

Ollamaで評価するときは，`promptfooconfig.yaml`のプロバイダの設定を`llm: ollama`に変える．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-1.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク，偽LLMのseedとnoise)
src/                    製品，プロバイダ，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONの置き場所
```
