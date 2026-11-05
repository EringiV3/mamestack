# モード

アプリだけが選ぶ。モックを利用者が OK した直後に、一度だけ選ぶ。モックの OK は、full-auto でも approval でも先にもらう。サイトはモードを聞かない。ヒアリングの途中や、実装が始まってから選び直さない。

## approval

設計書、チケットの粒度、各 PR を利用者が見る。ゲートの `--by user` は、その返事が会話にあるときだけエージェントが付ける。

向いているのは、公開物の文言や見た目を自分で握りたいとき。

## full-auto

設計書とチケット粒度はボットが確定してよい（`--by bot`）。実装も PR ごとに止まらない。デプロイ（`cf deploy`、`void deploy`、`npm run deploy`）も確認しない。`confirm-deploy --by bot` で記録する。

それでも次は必ず聞く。

- 本番データの削除。D1 / KV / R2 の削除、書き込み SQL、`--force`、`void db restore`、`void project rollback`
- `void secret put`
- ドメインの購入、DNS を変える操作
- 費用が出る操作。D1 / KV / R2 の作成、Workers Paid、Containers など

`void db restore --platform cloudflare --bookmark=…` はブックマーク以降の書き込みを消す。本番データなので確認が先。`void deploy` は Worker を上げる前に D1 のマイグレーションを適用するので、失敗しても適用が残ることがある。full-auto では、そのデプロイ自体では止まらない。

確認は `node tools/gate/cli.mjs guard --command "<そのまま実行するコマンド>"` で機械的に残す。サイトの Wrangler は `--root` を付ける。終了コード 3 は未確認、4 は禁止。アプリの Wrangler は禁止である。サイト（Astro）のビルドとデプロイは Wrangler を使う。

## どちらでも止まらないもの

ローカルの開発サーバー、テスト、検証動画の録画、ドキュメントの下書き、`cf cli search` と `cf schema` と `--dry-run`。`--dry-run` は資格情報なしで要求の JSON を出す、と Cloudflare 公式が書いている。

## 記録

選んだ語をプロダクトの `docs/03-mode.md` に一行以上書く。ゲートは、そのファイルに `full-auto` か `approval` が無いと `set-mode` を拒む。
