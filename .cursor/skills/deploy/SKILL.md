---
name: deploy
description: Deploy a mamestack product to Cloudflare and check the live URL. Use when shipping a site or app, opening the production URL, or touching billing, domains, or production data. Astro sites use Wrangler. Void apps use cf and the Void CLI.
---

# deploy

正本は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)、[docs/framework-selection.md](../../../docs/framework-selection.md)、[docs/modes.md](../../../docs/modes.md)。未検証のフラグは作らない。

1. `.mamestack/state.json` が無ければ `node tools/gate/cli.mjs init --root <root> --name <名前>`。
2. 依存は [setup](../setup/SKILL.md) の `npm ci` 済みであること。公開の呼び出しは `npm run deploy`。サイトの script は Wrangler、アプリの script は Void CLI。使い分けは [AGENTS.md](../../../AGENTS.md)。
3. 空の公開のタイミングは [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md) の空の公開。サイトはヒアリング直後の `implement`。アプリは設計とチケットの確定のあと、T1 を実装している `implement`。どちらも `confirm-deploy --milestone empty`。`v1` は全チケットの検証動画が揃って phase が `deploy` になってからである。
4. 実行する一行を、先に次へ通す。`--root` を付ける。

```sh
node tools/gate/cli.mjs guard --root <root> --command "<実行する一行>"
```

exit 3 は利用者の確認待ち、exit 4 は実行しない。確認の範囲は [docs/modes.md](../../../docs/modes.md)。

5. 出た本番 URL を開いて、表示を確認する。
6. 課金、ドメインの購入や DNS の変更、本番データの削除は、ゲートの結果にかかわらず必ず利用者に確認してから行う。
