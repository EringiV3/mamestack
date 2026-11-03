# Cloudflare へのデプロイ

公開先は Cloudflare。サイト（Astro）のビルドとデプロイは Wrangler。アプリは `cf` か Void CLI で、Wrangler は使わない。止まって、このファイルの TODO を利用者に見せる。

確認日: 2026-11-03。コマンド本文は公式からの引用で、この環境では Cloudflare にログインして実行していない。

## 確認できたこと

### `cf`（ベータ）

正本: [Cloudflare CLI](https://developers.cloudflare.com/cf/)、[Get started](https://developers.cloudflare.com/cf/get-started/)、[Use cf with coding agents](https://developers.cloudflare.com/cf/agents/)、[Deploy your first Worker](https://developers.cloudflare.com/cf/get-started/first-worker/)。

npm の `cf@1.0.0-beta.27`（homepage は `github.com/cloudflare/cf`）が 2026-11-03 のレジストリにあった。公式はベータであり、コマンドも設定も安定前に変わり得る、と書いている。

- 前提は Node.js 22.18 以上。Bun で `cloudflare.config.ts` を読むコマンドは失敗する、と Get started にある。
- インストール: `npm install --global cf`。同じ CLI が `cloudflare` という名前でも入る。`cf` が PATH で衝突するとき用。
- 確認: `cf --version`
- サインイン: `cf auth login`。遠隔では `cf auth login --no-browser`。確認は `cf auth whoami`。Wrangler のログインは再利用しない。
- 無人実行は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`。`cf` が読むファイルは `.env` だけで、`.env.local` は読まない。
- ゾーン一覧: `cf zones list`（標準出力は JSON）。
- コマンド探し: `cf cli search "create D1 database"`。資格情報は不要。公式の例では先頭が `cf d1 create`。中身は `cf schema d1 create`。試行は `cf d1 create --name my-database --dry-run`。
- 読み取りの例: `cf d1 query <DATABASE_ID> --sql "SELECT 1"`。識別子は名前ではなく API の ID。
- プロジェクト: `cf init my-worker`、既存ディレクトリは `cf init .`。開発・ビルド・公開は `cf dev` / `cf build` / `cf deploy`。設定ファイルは `cloudflare.config.ts`。
- Wrangler 設定しか無いディレクトリで `cf dev` / `cf build` / `cf deploy` / `cf init .` を走らせない。`cf migrate --dry-run` のあと `cf migrate`。アプリの新規プロダクトは Wrangler 設定を作らない。サイト（Astro）は Wrangler で出す。
- `--dry-run` は要求を JSON で出すだけで送らない。資格情報も要らない、とエージェント向けページにある。
- 非対話で、破壊的コマンドを `--force` 無しで実行すると、標準エラーに `Aborted.` と出て終了コードが 0 になることがある。0 を「削除できた」と読まない。
- `--local` は一部だけ（KV のキー、`cf d1 raw`、`cf d1 migrations list`、`cf d1 migrations apply`、R2 オブジェクト）。`cf d1 query` にローカルは無い。
- カスタムドメインの設定項目として、`cloudflare.config.ts` の worker に `domains?: string[]` がある（[config explorer](https://developers.cloudflare.com/cf/projects/config-explorer/) と [cloudflare.config.ts](https://developers.cloudflare.com/cf/projects/cloudflare-config/)）。Wrangler の `routes` + `custom_domain: true` は `worker.domains` に対応する、と [Wrangler からの対照表](https://developers.cloudflare.com/cf/wrangler/reference/) にある。ドメインを付けると DNS が作られる。実行前に確認する。
- エージェント向けの探し方: コマンドは `cf cli search`、ドキュメントは `cf docs search`。どちらもアカウント ID やドメインをクエリに入れない。

### Astro と `cf` の穴

[Deploy your first Worker](https://developers.cloudflare.com/cf/get-started/first-worker/) は、`cf` が Astro を検出してもビルドできるとは限らない、と書いている。引用: Astro 6 以降はベータ期間中 `cf` でビルドできない。2026-11-03 の npm の Astro は 7.4.5 なので、現行の Astro はこの記述の内側にある。

したがってサイトは `cf deploy` を使わない。空ページから本番へは、Cloudflare が Astro 向けに案内している Wrangler で出す。

生成リポジトリでは、このコマンドを `package.json` の `deploy` に書き、`npm run deploy` で実行する。`npx` で最新を取りに行かない。

```sh
npm run deploy
```

実行前に `guard --root <プロダクト> --command "npm run deploy"` と利用者の確認が要る。Void アプリへ作り替えない。アプリの `deploy` script は `void deploy --platform cloudflare` であり、Wrangler に切り替えない。`void init` は `--deploy none` なので、プラットフォームを script に書く。

### Void CLI

アプリケーションの公開手順は `docs/framework-selection.md` に書いた。繰り返すと、確認できたコマンドは次である。

```sh
npm install -D void
npx void init
npm run dev
npx void deploy
npx void deploy --platform cloudflare
void connect --platform cloudflare
void db generate
void secret put
void project status
void project logs
void project rollback
```

生成したアプリの `scripts.deploy` は `void deploy --platform cloudflare`。呼び出しは `npm run deploy`。`void init --deploy none` のあと、プラットフォーム無しの `void deploy` では公開先が決まらない。

`void deploy` は資源を作りマイグレーションを適用する。初回と、マイグレーションがあるたびに確認する。Sandbox は Workers Paid と Containers が要る、と Deployment ページにある。スターターでそれを選ばない。

## マイルストーン

ゲートは `empty` と `v1` を持つ。`empty` は空の公開、`v1` は機能の入った公開である。

### 空の公開

サイトはヒアリングの直後、phase が `implement` になったところである。アプリは設計とチケットの確定が終わったあと、同じく `implement` の T1「空のアプリをCloudflare本番に出す」である。`init` の直後にはしない。ここで `v1` は使わない。

1. `confirm-deploy --root <root> --milestone empty --decision run --by user --reason "..."`
2. `guard --root <root> --command "npm run deploy"` が confirm を返したら、利用者の確認のあと `npm run deploy`。
3. 終了コード 0 なら `mark-deploy --root <root> --milestone empty --exit 0`。phase は `implement` のまま。
4. 出た URL を開いて、空であることが見えることを確認する。

### v1

1. 全チケットの検証動画が揃う（phase が `deploy`）。
2. 上の未検証を利用者に見せる。
3. 費用と、公開される URL の範囲を言う。
4. `guard --command "<実行する一行>"` が confirm を返したら、返事を待つ。
5. `confirm-deploy --milestone v1 --decision run --by user --reason "..."` のあとだけ実行する。
6. 終了コード 0 なら `mark-deploy --milestone v1 --exit 0`。

アカウントが無い、または TODO が残っているなら `decision skip` と理由を残し、工程を閉じる。黙って未デプロイのまま done にしない。

## エージェントの手順（資源を足すとき）

D1 以外の正確なサブコマンドは、このファイルに写さない。作業のたびに次の順で、公式の出力を読む。

1. `cf cli search "<やりたいこと>"`
2. `cf schema <出たコマンド>`
3. 公式が示すフラグだけで `--dry-run`
4. `guard` と利用者の確認
5. `--dry-run` を外して実行

KV と R2 の create サブコマンド名は、2026-11-03 の調査では公式例を `cf d1 create` 以外に固定しなかった。TODO のままである。

## TODO（未検証。コマンドを作らない）

- Astro の成果物を `cf build` / `cf deploy` で実際に Workers へ載せる手順。公式がベータの制限を書いている。
- 独自ドメインを購入する `cf` のコマンド名。購入は費用がかかる。`domains` フィールドの存在は確認済みで、購入 API の CLI 形は未確認。
- KV と R2 を新規作成するサブコマンドの確定した綴り。使う直前に `cf cli search` する。
- `cf` と `void` の、このファイルに書いた以外のフラグ。
- この環境から Cloudflare へログインして `cf deploy` や `void deploy` が成功すること。資格情報が無く、実行していない。
