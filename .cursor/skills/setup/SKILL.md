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

この4つだけ `^` を付けない。`void init` が足す `hono` や `react` などの `^` は消さない。再現はコミットした `package-lock.json` の `npm ci` で固定する。

`void@1.5.0` の `engines` は `node: ^24.22.0 || >=26.12.0`。アプリの `.node-version` は `24.22.2`。サイトの `.node-version` は `22.23.4`。

`void@1.5.0` が入れる `better-sqlite3@13.0.3` は、npm パッケージ内の `prebuilds/linux-x64.node` で Node 24.22.2（ABI 137）の linux-x64 に載った。`select 1` まで確認した。`gypfile` は false で install スクリプトは無い。GitHub Releases の v13.0.3 には `node-v137` の tar は無い。同梱の `linux-x64.node` を使うので、この組み合わせでは make も g++ も要らない。`npm` が `install: node-gyp rebuild` として承認を求めても承認しない。musl などでそのファイルを使えないときだけ、make と g++ を入れてから `npm ci` する。

## アプリ

作業ディレクトリはプロダクトのルートだけである。`void init` はパスを取らない。

1. そこに `package.json` を置く。`name` が Worker 名になる（`void@1.5.0` は `package.json` の `name`、無ければディレクトリ名）。`"type": "module"` にする。

```json
{
  "name": "<worker-name>",
  "private": true,
  "type": "module"
}
```

2. `void@1.5.0` を入れてから、同じディレクトリで次を実行する。`CI=1` と、標準入力を閉じる。`--deploy none` にすると、ブラウザログインと GitHub workflow の質問を避ける。非対話では `--framework` が要る、と CLI が言った。

```sh
CI=1 ./node_modules/.bin/void init --no-git --toolchain vite-plus --framework react --starter static --deploy none </dev/null
```

3. `cf@1.0.0-beta.27` と `playwright@1.64.1` を `devDependencies` に足す。`scripts.deploy` は `void deploy`。
4. 新しいプロジェクトだと `void init` は `AGENTS.md` を作る。工場の `AGENTS.md` をそのあとで上書きし、工程の正本は工場側のままにする。`CI=1` で既に工場の `AGENTS.md` があるときは、Void はそれを書き換えない。
5. `.void-wrangler.jsonc` は `void deploy` が読む生成物である。アプリから Wrangler CLI を呼ぶことにはならない。消さない。`wrangler` パッケージは入れない。

`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` があるときは、`void cloudflare login` も `void connect` も実行しない。`void deploy` は `CLOUDFLARE_API_TOKEN`（無ければ `CF_API_TOKEN`）を自分で読む。アカウント ID は次の `result[].id` である。

```sh
curl -s https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

トークン作成は、Workers Scripts、Workers KV Storage、Workers Routes の Edit が入った次の URL で足りた。

https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_routes%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=*&zoneId=all

## サイト

`npm create astro@5.3.1 -- <dir> --yes --no-git --install --skip-houston`。2026-11-03 に非対話で通り、テンプレート `basics` を置いた。`scripts.deploy` は `wrangler deploy`。`wrangler@4.156.2` と `playwright@1.64.1` を足す。

## 共通

`.node-version` と `package-lock.json` をコミットする。入れ直しは `rm -rf node_modules && npm ci`。

ブラウザは `npm ci` のあと、ロックされた `playwright` で入れる。`@latest` や版の指定は足さない。`apt` と `sudo` があるとき:

```sh
npx playwright install --with-deps chromium
```

それが無いときは OS パッケージを入れず、ブラウザだけ入れる。起動に失敗したときの扱いは [docs/verification-video.md](../../../docs/verification-video.md)。

```sh
npx playwright install chromium
```
