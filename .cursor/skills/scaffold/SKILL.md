---
name: scaffold
description: Initialize a mamestack product and ship an empty production deploy. Use when creating a repo, scaffolding Astro or Void, placing docs/prd.md and docs/design-doc.md, or deploying the empty site or app before building features.
---

# scaffold

正本は [AGENTS.md](../../../AGENTS.md)、[docs/framework-selection.md](../../../docs/framework-selection.md)、[docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)。規則をここに写さない。

1. `.mamestack/state.json` が無ければ `node tools/gate/cli.mjs init --root <root> --name <名前>`。アプリの `<名前>` は、あとで書く `package.json` の `name`（Worker 名）と揃える。
2. `node tools/gate/cli.mjs next --root <root>` に従う。サイトかアプリかはヒアリングの結果で決まる。
3. `docs/prd.md` と `docs/design-doc.md` が無ければ、`templates/prd.md` と `templates/design-doc.md` をそのパスへ置く。`init` が既に置いていれば上書きしない。中身の埋め方は [AGENTS.md](../../../AGENTS.md)。
4. サイトだけ、ヒアリングの直後に [setup](../setup/SKILL.md) のサイトの節を行う。`wrangler.jsonc` が無ければ、`name` と `assets.directory` `"./dist"` だけを書く。アダプターは入れない。`scripts.deploy` は `astro build && wrangler deploy`。`wrangler` は `4.156.2` のまま `-E` で固定する。設定が無いと `wrangler deploy` が自動生成し、`@astrojs/cloudflare`、`wrangler` の `^`、SESSION と IMAGES のバインディングが入った。空の公開へ進む。道は [deploy](../deploy/SKILL.md) と [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md) の空の公開。`v1` は使わない。
5. アプリの `void init` と空の公開は、ここではしない。設計とチケットが終わり、phase が `implement` で T1 を開いてから [setup](../setup/SKILL.md) のアプリの節と [deploy](../deploy/SKILL.md) に進む。
