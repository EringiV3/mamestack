---
name: setup
description: Install pinned mamestack CLIs and browsers for a generated repo. Use before scaffold, when adding wrangler, cf, or the Void CLI, when writing package-lock.json or .node-version, or when running npm ci.
---

# setup

公開手順の正本は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md) と [docs/framework-selection.md](../../../docs/framework-selection.md)。CLI の選び分けは [AGENTS.md](../../../AGENTS.md)。ここに規則を写さない。

2026-11-03 に `npm view <name> version` で確認した。どれも npm にある。インストールスクリプトは作らない。`^` は付けない。`npx` で最新を取らない。グローバルインストールはしない。

| パッケージ | バージョン | 入れる相手 |
| --- | --- | --- |
| `wrangler` | `4.156.2` | サイト |
| `cf` | `1.0.0-beta.27` | アプリ |
| `void` | `1.5.0` | アプリ |
| `playwright` | `1.64.1` | 両方 |

`void@1.5.0` の `engines` は `node: ^24.22.0 || >=26.12.0`。アプリの `.node-version` は、その範囲で確認した `24.22.2`。サイトの Astro テンプレートが書いた `engines` は `>=22.23.4`。サイトの `.node-version` は、その範囲で確認した `22.23.4`。

1. サイトは `npm create astro@5.3.1 -- <dir> --yes --no-git --install --skip-houston`。これは 2026-11-03 に非対話で通り、テンプレート `basics` と `astro@7.4.5` を置いた。アプリは、固定した `void` を入れてから `void init --no-git --toolchain vite-plus --framework react --starter static --deploy cloudflare`。非対話では `--framework` が要る、と CLI が言った。
2. `devDependencies` に上の表を正確な版で足す。`dependencies` に CLI を置かない。
3. `scripts.deploy` はサイトが `wrangler deploy`、アプリが `void deploy`。呼び方は `npm run deploy` だけ。
4. `.node-version` と `package-lock.json` をコミットする。
5. 依存の入れ直しは `rm -rf node_modules && npm ci`。
6. ブラウザは `npm ci` のあと、ロックされた `playwright` で次を実行する。`@latest` や版の指定を足さない。

```sh
npx playwright install --with-deps chromium
```

確認: 2026-11-03 に空の Astro（Node 22.23.4）と空の Void（Node 24.22.2）で `npm ci` は終了コード 0。`wrangler --version` は `4.156.2`、`cf --version` は `1.0.0-beta.27`、`void --version` は `1.5.0`、`playwright --version` は `1.64.1`。Playwright の `install --with-deps chromium` も両方終了コード 0。Void の `init` はファイルを作った。Cloudflare へのログインは資格情報が無く完了していない。本番への `npm run deploy` は実行していない。
