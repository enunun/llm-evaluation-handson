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
| Iteration 2 | 作成中 |
| Iteration 3 | 未着手 |
| Iteration 4 | 未着手 |
| Iteration 5 | 未着手 |

## 作業中：Iteration 2

- [x] Iteration 1の解答を演習と解答にコピーし，パッケージ名を変える
- [x] 解答に`simple-statistics`，`@stdlib/stats-binomial-test`，`@stdlib/stats-base-dists-normal-quantile`を加える(`simple-statistics`の`probit`は近似の精度が低いため，正規分布の分位点はstdlibを使う)
- [x] 単体テストを先に書き，失敗を確かめる(`stats`，`summary`，`report`，`cli`の`--target`と`--confidence`)
- [x] 解答の実装と統合テスト
- [ ] 設計文書(モジュール依存図，型，ADR 0003)
- [ ] 解答と演習の`TESTLIST.md`，`README.md`，`docs/iteration-2.md`，ノート
- [ ] Ollama(qwen2.5:0.5b)での実行結果を取る
- [ ] `mise run check`，演習と前の解答の差分の確認，コミット

## これからの作業

1. Iteration 3：返信の下書き，`not-icontains`，LLM Judge，意思決定モデル(Tev1)，4値の採点結果，`show`．
2. Iteration 4：人手ラベルのスイート，`calibrate`(TPR，TNR，自己一貫性，しきい値)，Rogan-Gladen補正．
3. Iteration 5：対応のある差，最小検出差，非劣性マージンによるゲート，`eval:gate`．
4. Dev Containerを実際にビルドし，コンテナの中で`mise run check`を通す．

## 作成の環境についての覚え書き

- Ollamaでの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行う．教材に載せるOllamaの出力には，使ったモデルを書く．
