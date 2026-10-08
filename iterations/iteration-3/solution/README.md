# Iteration 2 解答：標準誤差と信頼区間を付ける

タスクごとの合格率の信頼区間(Clopper-Pearson法)，採点器ごとの標準誤差と信頼区間，目標との比較を表示する`evalstats`の完成形である．
演習の手順ごとの解説は[docs/iteration-2.md](docs/iteration-2.md)にある．

## 動かし方

```console
pnpm test
pnpm eval --repeat 10 -o results/fake.json
pnpm evalstats summary results/fake.json --target 0.9
```

Ollamaで評価するときは，`promptfooconfig.yaml`のプロバイダの設定を`llm: ollama`に変える．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-2.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク，偽LLMのseedとnoise)
src/                    製品，プロバイダ，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONの置き場所
```
