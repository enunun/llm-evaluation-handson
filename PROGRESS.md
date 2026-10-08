# 教材作成の進捗

教材を作る人向けに，作成の進み具合とこれからの作業を記録する．
コースの計画は[COURSE.md](COURSE.md)に，各Iterationの内容は[docs/ROADMAP.md](docs/ROADMAP.md)にある．

## 状況

| 項目 | 状態 |
| --- | --- |
| コース計画(`COURSE.md`，`docs/ROADMAP.md`) | 完了 |
| リポジトリの土台(Dev Container，mise，検査スクリプト，ガイド) | 完了(Dev Containerのビルドは未確認) |
| Iteration 0 | 完了 |
| Iteration 1 | 完了 |
| Iteration 2 | 完了 |
| Iteration 3 | 完了 |
| Iteration 4 | 完了 |
| Iteration 5 | 作成中 |

## 作業中：Iteration 5

- [ ] Iteration 4の解答を演習と解答にコピーし，パッケージ名を変える
- [ ] `stats`に対応のある差(`pairedDifference`)と最小検出差(`minimumDetectableEffect`)を加える
- [ ] `compare`(採点器ごとの比較と判定，比較できない結果の拒否)と`gate`(非劣性マージン)
- [ ] `promptfooResult`で採点器の設定を読み，比較できるかを確かめる
- [ ] `cli`の`compare`サブコマンド(`--margin`)と，`package.json`の`eval:gate`スクリプト
- [ ] 設計文書(ADR 0006)，教材の文章，ノート
- [ ] Ollamaで，同じモデルどうし(A/A)と，qwen2.5:0.5bとqwen2.5:3bを比べた結果を取る
- [ ] `mise run check`，演習と前の解答の差分の確認，コミット

## これからの作業

1. Dev Containerを実際にビルドし，コンテナの中で`mise run check`を通す．

## 作成の環境についての覚え書き

- Ollamaでの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行う．教材に載せるOllamaの出力には，使ったモデルを書く．
