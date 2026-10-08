# Iteration 5 解答：比較して回帰を止める

2つの評価結果を採点器ごとに比べる`evalstats compare`と，非劣性マージンで回帰を止めるゲート(`--margin`，`pnpm eval:gate`)の完成形である．
演習の手順ごとの解説は[docs/iteration-5.md](docs/iteration-5.md)にある．

## 動かし方

```console
pnpm test
pnpm eval --repeat 10 -o results/baseline.json
# promptfooconfig.yamlを変えて(たとえばプロバイダのnoiseを0.3に)評価する
pnpm eval --repeat 10 -o results/head.json
pnpm evalstats compare results/baseline.json results/head.json
pnpm eval:gate
```

`pnpm eval:gate`は，`results/baseline.json`と`results/head.json`をマージン0.05で比べ，ゲートに落ちたら終了コード1を返す．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-5.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク，返信の4タスク)
labels.yaml             人手ラベルのスイート(返信20件，dev/test各10件)
src/                    製品，プロバイダ，採点器，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONと検証結果の置き場所
```
