# Iteration 0 解答：1回だけ評価する

問い合わせを分類する製品の関数`classifyInquiry`と，それを呼ぶpromptfooのカスタムプロバイダ，promptfooの結果JSONを表示するCLI`evalstats`の完成形である．
演習の手順ごとの解説は[docs/iteration-0.md](docs/iteration-0.md)にある．

## 動かし方

```console
pnpm test
pnpm eval -o results/fake.json
pnpm evalstats summary results/fake.json
```

Ollamaで評価するときは，`promptfooconfig.yaml`のプロバイダの設定を`llm: ollama`に変える．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-0.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク)
src/                    製品，プロバイダ，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONの置き場所
```
