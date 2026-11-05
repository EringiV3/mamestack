# フレームワークの選び方

規則は二つだけである。

- ウェブサイト（ビルド時に内容が決まり、来訪者ごとのサーバー処理が要らない）は Astro。
- アプリケーション（入力、ログイン、保存、リクエストごとの処理）は Void。Void SDK を使い、Void CLI で出す。

ホスティングは基本的に Cloudflare（Workers、必要なとき D1 / R2 / KV）。サイト（Astro）のビルドとデプロイは Wrangler。アプリは `cf` か Void CLI で、Wrangler ではない。

ヒアリングの `shape` が `static` で、`data` が「なし」で始まるとき、ゲートは Astro 以外を拒む。`dynamic` のとき、または保存するデータがあるとき、ゲートは Void 以外を拒む。静的と答えて保存もある場合は、アプリケーションとして Void を選び、その理由を設計書に書く。

性能を先に決める。

- ビルド時に分かる画面は静的な HTML のまま出す。
- React や Vue を、ボタン一つのために足さない。
- クライアント JS は、v1 の操作が本当に要る箇所だけ。
- 画像とウェブフォントは、ページの用件になってから足す。
- データがあるなら、計算は Workers の近く（D1）で済ませ、ブラウザとの往復を増やさない。

## Astro（サイト）

確認日: 2026-11-03。正本は [Install Astro](https://docs.astro.build/en/install-and-setup/)。

- 前提の Node.js は v22.23.4 以上。奇数の版（v23 など）は非対応、と公式のインストールページにある。
- 新規作成は `npm create astro@latest`。依存関係のインストールを飛ばしたら、ディレクトリで `npm install`。
- 公式の手動手順が置くスクリプトは `astro dev` / `astro build` / `astro preview`（`package.json` の `dev` / `build` / `preview`）。
- Astro はローカルに入れる。`npm install -g astro` は公式が禁じている。
- npm 上の `astro` は、2026-11-03 に `7.4.5` だった。版は動くので、ピンはプロダクト側で行う。

サイトにサーバー処理が要るようになったら、Astro にアダプターを足して続行しない。ヒアリングをやり直すのではなく、設計書で Void に切り替える理由を書き、ゲートの規則（保存があるなら Void）に合わせる。Void のドキュメントは Astro 7 をメタフレームワークとして載せるが、mamestack の既定はその経路を使わない。コンテンツサイトのまま D1 が要る、と設計で説明できるときだけ例外にし、デプロイは `void deploy` にする。その手順は [Astro | Void](https://void.cloud/integrations/frameworks/astro) を、作業の日に取り直す。2026-11-03 に取得したページは Astro 7 以上（Vite 8 が要る）と `nodejs_als` を要求していた。検索インデックスには Astro 6 以上という古い要約が残っていた。

## Void（アプリケーション）

確認日: 2026-11-03。正本は [Quickstart](https://void.cloud/guide/quickstart) と [Deployment](https://void.cloud/guide/deployment)。

npm の `void@1.5.0` は説明が "Full-stack framework and deployment CLI for Cloudflare Workers, powered by Vite." で、homepage は `https://void.cloud` だった。リポジトリは `voidzero-dev/void`。別の `void` パッケージと取り違えない。

空のディレクトリで:

```sh
npm install -D void
npx void init
```

UI、スターター、デプロイ先を選ぶ。最初のデータベースには D1 が向く、と Quickstart にある。ローカルは別のデータベースサーバー無しで動く。Cloudflare を選ぶか、あとで接続する。

ローカル起動は `npm run dev`。Quickstart は `http://localhost:5173` を開くと書いている。

公開:

```sh
npx void deploy
```

セットアップで先を選ばなかった場合:

```sh
npx void deploy --platform cloudflare
```

あとからアカウントを繋ぐ場合は、Deployment ページの次である。

```sh
void connect --platform cloudflare
void deploy --platform cloudflare
```

`void deploy` はビルドし、資源を作り、`db/migrations/` の SQL を適用し、URL を出す。スキーマだけ変わっていると止まり、`void db generate` で SQL を出してから、人間が読んでコミットする。ロールバックはマイグレーションを戻さない。D1 では適用前に復元ポイントを残し、`void db restore` のコマンドを表示する、と Deployment にある。`void db restore` は破壊的なので、full-auto でも確認する。`void deploy` 自体は、full-auto では確認しない。

本番シークレットは `void secret put`。ローカルの `.env` はアップロードしない、と公式にある。approval とサイトは確認してから置く。full-auto では確認しない。

ログとロールバック:

```sh
void project status
void project logs
void project rollback
```

`void project rollback` はマイグレーションを戻さない。approval とサイトは確認する。full-auto では、データを消さないので確認しない。古いコードが今のスキーマで動くかを先に見る。

Void のチーム向けプラットフォーム（`void deploy --platform void`）は mamestack の既定にしない。個人の Cloudflare アカウントへ出す。

## 両方に共通

- 選定理由を設計書に一文で残す。ゲートはその文が設計書にあることを見る。
- `later` の機能のための依存を、v1 の PR に入れない。
- 未検証のフラグを足して「たぶん動く」にしない。`docs/cloudflare-deploy.md` の TODO を見る。
