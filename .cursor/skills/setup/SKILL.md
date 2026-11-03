---
name: setup
description: Install pinned mamestack CLIs and browsers for a generated repo. Use before scaffold, when adding wrangler, cf, or the Void CLI, when writing package-lock.json or .node-version, or when running npm ci.
---

# setup

公開の規則は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)、フレームワークは [docs/framework-selection.md](../../../docs/framework-selection.md)、CLI の選び分けは [AGENTS.md](../../../AGENTS.md)。

2026-11-03 に `npm view <name> version` で確認した。どれも npm にある。インストールスクリプトは作らない。`npx` で最新を取らない。グローバルインストールはしない。

| パッケージ | バージョン | 入れる相手 |
| --- | --- | --- |
| `wrangler` | `4.156.2` | サイト |
| `cf` | `1.0.0-beta.27` | アプリ |
| `void` | `1.5.0` | アプリ |
| `playwright` | `1.64.1` | 両方 |
| `better-sqlite3` | `12.11.1` | アプリ（`overrides`） |

この表の版は `npm i -D -E <name>@<version>` で入れる。`^` は保存されない。`void init` が足す `hono` や `react` などの `^` は消さない。再現はコミットした `package-lock.json` の `npm ci` で固定する。

想定する npm は 11.x。install script は allowScripts で既定では走らない。esbuild、workerd、better-sqlite3 は警告が出る。ビルドとデプロイはそのままで動く。better-sqlite3 の script は許可しない。許可すると node-gyp が走る。

## Node

アプリの `.node-version` は `24.22.2`（`void@1.5.0` の `engines` は `^24.22.0 || >=26.12.0`）。サイトは `22.23.4`。

`node -v` が `v` と `.node-version` の中身を繋げたものと違うときは、先にその版を入れる。公式の配布は `https://nodejs.org/dist/v<version>/node-v<version>-<os>-<arch>.tar.xz`。展開した `bin` を `PATH` の先頭に置く。もう一度 `node -v` が一致するまで先へ進まない。

## アプリ

タイミングは [AGENTS.md](../../../AGENTS.md) の T1。設計とチケットの確定のあとである。作業ディレクトリはプロダクトのルートだけである。`void init` はパスを取らない。

1. `package.json` を置く。`name` が Worker 名になる（`void@1.5.0` は `package.json` の `name`、無ければディレクトリ名）。`"type": "module"` にする。

```json
{
  "name": "<worker-name>",
  "private": true,
  "type": "module",
  "overrides": { "better-sqlite3": "12.11.1" }
}
```

2. `.mamestack` と `docs` は、`void@1.5.0` が空のプロジェクトとみなす名前の一覧に無い。残したまま `void init` すると、フラグが無い「Choose a database setup」で止まる。`void@1.5.0` の init が受け取るのは `tsconfig` `github` `git` `toolchain` `framework` `starter` `deploy` だけである。この二つを一時ディレクトリへ移してから init し、終わったら戻す。
3. `npm i -D -E void@1.5.0`
4. 同じディレクトリで次を実行する。`--starter static` がある空のプロジェクトでは、データベースの質問を飛ばす。`--deploy none` はブラウザログインと GitHub workflow の質問を避ける。`CI=1` と、標準入力を閉じる。`void init` は postinstall に `void prepare` を足し、`overrides` に `vite` を足す。

```sh
CI=1 ./node_modules/.bin/void init --no-git --toolchain vite-plus --framework react --starter static --deploy none </dev/null
```

5. `npm i -D -E cf@1.0.0-beta.27` と `npm i -D -E playwright@1.64.1`。`overrides` に `"better-sqlite3": "12.11.1"` を書く。`void@1.5.0` が入れる `13.0.3` は、Node 24.22.1 の `npm ci` が `node-gyp rebuild` を実行し、make が無いと失敗した。`12.11.1` には GitHub Releases の `node-v137` linux-x64 があり、make も g++ も python も無い状態の `npm ci` が終了コード 0 だった。`void prepare` とその `select 1` も通った。
6. `scripts.deploy` は `void deploy --platform cloudflare`。`--deploy none` のあと、プラットフォーム無しの `void deploy` では公開先が決まらない。
7. 工場の `AGENTS.md` を戻す。工程の正本は工場側である。`void init` が新しいプロジェクトに書いた Void の `AGENTS.md` は、工場のファイルで置き換える。
8. `.void-wrangler.jsonc` は `void deploy` が読む生成物である。アプリから Wrangler CLI を呼ぶことにはならない。消さない。`wrangler` パッケージは入れない。

`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` があるときは、`void cloudflare login` も `void connect` も実行しない。`void deploy` は `CLOUDFLARE_API_TOKEN`（無ければ `CF_API_TOKEN`）を自分で読む。アカウント ID は次の `result[].id` である。

```sh
curl -s https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

DB、認証、ストレージ、AI を使うアプリは、Workers Scripts、Workers KV Storage、Workers Routes の Edit に加え、D1 の Edit と R2 の Edit が要る。テンプレートの permission reference（[API token template URLs](https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/)）で短いキーを確認できたのは `d1`（D1 database）と `workers_r2`（R2 storage）だけである。Workers AI Read の短いキーは同じ表に無かったので URL には入れない。フォームで + add、Account > Workers AI > Read。

https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_routes%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_r2%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=*&zoneId=all

R2 はダッシュボードで一度有効にする。無料枠でも請求情報を聞く。利用者の確認が要る。

## サイト

空のディレクトリで先に `npm create astro@5.3.1 -- <dir> --yes --no-git --install --skip-houston`。そのあと `node tools/gate/cli.mjs init --root <dir> --name <名前>`。`.mamestack` や `docs` があると create-astro は空でないと判断し、終了コード 0 のままランダムな名前の子フォルダ（例 `./fumbling-fireball`）を作る。create-astro は `AGENTS.md` と `README.md` を置く。init はそれらを書き換えず、`.mamestack` と `docs/prd.md` と `docs/design-doc.md` だけを足す。工場の `AGENTS.md` で上書きしない。`npm i -D -E wrangler@4.156.2` と `npm i -D -E playwright@1.64.1`。`scripts.deploy` は `astro build && wrangler deploy`。`wrangler.jsonc` は [scaffold](../scaffold/SKILL.md) が `name`、`compatibility_date`（scaffold した日）、`assets.directory` `"./dist"` を書く。

## 共通

`.node-version` と `package-lock.json` をコミットする。入れ直しは `rm -rf node_modules && npm ci`。`better-sqlite3` の `node-gyp rebuild` は承認しない。

ブラウザは `npm ci` のあと、ロックされた `playwright` で入れる。`@latest` や版の指定は足さない。`apt` と `sudo` があるとき:

```sh
npx playwright install --with-deps chromium
```

無いときは OS パッケージを入れず、ブラウザだけ入れる。起動に失敗したときの扱いは [docs/verification-video.md](../../../docs/verification-video.md)。

```sh
npx playwright install chromium
```
