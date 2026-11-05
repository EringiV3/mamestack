# モード

アプリだけが選ぶ。モックを利用者が OK した直後に、一度だけ選ぶ。モックの OK は、full-auto でも approval でも先にもらう。サイトはモードを聞かない。ヒアリングの途中や、実装が始まってから選び直さない。

## approval

設計書、チケットの粒度、各 PR を利用者が見る。ゲートの `--by user` は、その返事が会話にあるときだけエージェントが付ける。

向いているのは、公開物の文言や見た目を自分で握りたいとき。

## full-auto

設計書とチケット粒度はボットが確定してよい（`--by bot`）。実装も PR ごとに止まらない。確認するのは次の三つだけである。`confirm-deploy --by bot` でデプロイを記録する。

- 本番データの削除。DROP / DELETE / TRUNCATE、D1 / KV / R2 の削除、`void db restore` のように本番データを消す復元やロールバック
- ドメインの購入や変更、DNS、カスタムドメイン
- 費用がかかる操作。有料プラン、Workers Paid、Containers などの有料枠

無料枠の D1、KV、R2、Workers の作成、壊さないマイグレーション（INSERT / UPDATE / ALTER）、`void secret put`、`--force` のデプロイ、データを消さない `void project rollback` は確認しない。

`void db restore --platform cloudflare --bookmark=…` はブックマーク以降の書き込みを消す。本番データなので確認が先。`void deploy` は Worker を上げる前に D1 のマイグレーションを適用するので、失敗しても適用が残ることがある。full-auto では、そのデプロイ自体では止まらない。

確認は `node tools/gate/cli.mjs guard --command "<そのまま実行するコマンド>"` で機械的に残す。サイトの Wrangler は `--root` を付ける。終了コード 3 は未確認、4 は禁止。アプリの Wrangler は禁止である。サイト（Astro）のビルドとデプロイは Wrangler を使う。

## どちらでも止まらないもの

ローカルの開発サーバー、テスト、検証動画の録画、ドキュメントの下書き、`cf cli search` と `cf schema` と `--dry-run`。`--dry-run` は資格情報なしで要求の JSON を出す、と Cloudflare 公式が書いている。

## 記録

選んだ語をプロダクトの `docs/03-mode.md` に一行以上書く。ゲートは、そのファイルに `full-auto` か `approval` が無いと `set-mode` を拒む。
