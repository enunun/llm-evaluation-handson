# ノート

各Iterationで初めて使う概念，ツール，構文をまとめる．
演習の手順「構文と概念」で読む．

| Iteration | ノート | 主な内容 |
| --- | --- | --- |
| 0 | [iteration-0.md](iteration-0.md) | 評価の用語，品質特性(QA4AIとISO/IEC 25059)，promptfooの構成と結果JSON，LLMのポート，テストダブル，出力の正規化，型の除去で実行するTypeScript，zod，Vitest |
| 1 | [iteration-1.md](iteration-1.md) | 非決定性の源，複数回の試行，pass@kとpass^k，stable/flaky/broken，シード付き擬似乱数と並行な試行，再現のための記録，`parseArgs` |
| 2 | [iteration-2.md](iteration-2.md) | 評価のスコアと推定，標準誤差と中心極限定理，タスクを単位にしたクラスタ化，二項分布とClopper-Pearson区間，目標の合格率と判定不能，統計のライブラリ |
| 3 | [iteration-3.md](iteration-3.md) | 採点器の分類，ルーブリック，構造化出力，採点の結果の4つの値，意思決定モデル，promptfooのカスタムアサーション，YAMLのアンカー，トランスクリプトを読む |
| 4 | [iteration-4.md](iteration-4.md) | 評価器も測定器であること，人手ラベル，混同行列とTPR，TNR，自己一貫性，しきい値，dev/testの分割，Rogan-Gladen補正，ブートストラップ |
| 5 | [iteration-5.md](iteration-5.md) | 2つの版の比較，対応のある差と相関，検出力と最小検出差，「差がない」と「差を検出できない」，非劣性マージン，A/A比較と偽陽性，能力評価と回帰評価，終了コードとCI，基準となる結果の管理，`Promise.all` |
