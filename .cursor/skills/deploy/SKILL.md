---
name: deploy
description: Deploy a mamestack product to Cloudflare and check the live URL. Use when shipping a site or app, opening the production URL, or touching billing, domains, or production data. Astro sites use Wrangler. Void apps use cf and the Void CLI.
---

# deploy

正本は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)、[docs/framework-selection.md](../../../docs/framework-selection.md)、[docs/modes.md](../../../docs/modes.md)。未検証のフラグは作らない。

1. サイト（Astro）は Wrangler。アプリ（Void）は `cf` と Void CLI。どちらを使うかは [AGENTS.md](../../../AGENTS.md) のデプロイの節。
2. 実行する一行を、先に次へ通す。サイトの Wrangler は `--root` を付ける。

```sh
node tools/gate/cli.mjs guard --root <root> --command "<実行する一行>"
```

exit 3 は利用者の確認待ち、exit 4 は実行しない。確認の範囲は [docs/modes.md](../../../docs/modes.md)。

3. マイルストーン `v1` は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md) のマイルストーンの順。`confirm-deploy` のあとだけ実行し、成功したら `mark-deploy`。
4. 出た本番 URL を開いて、表示を確認する。
5. 課金、ドメインの購入や DNS の変更、本番データの削除は、ゲートの結果にかかわらず必ず利用者に確認してから行う。
