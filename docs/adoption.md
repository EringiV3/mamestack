# 工場をプロダクトに入れる

mamestack はアプリのテンプレートではなく、エージェントが従う定義である。プロダクトのソースと、工程の状態（`.mamestack/state.json`）を同じ git に置く。

## 新しいプロダクト

1. 空の git リポジトリを作る。
2. この工場から次をコピーする。`examples/` はコピーしない。

   - `AGENTS.md`
   - `.cursor/rules/mamestack.mdc`
   - `.cursor/skills/mamestack/SKILL.md`
   - `templates/`
   - `tools/gate/`
   - `tools/verify-record/`
   - `docs/framework-selection.md`
   - `docs/cloudflare-deploy.md`
   - `docs/verification-video.md`
   - `docs/modes.md`
   - `docs/sources.md`
   - `package.json` の `playwright` 依存と、`gate` / `record` スクリプト。プロダクトが既に `package.json` を持つなら、依存とスクリプトだけ足す。

3. ルートで `npm install` と `npx playwright install chromium`。
4. エージェントに、こう頼む。

   ```text
   mamestack で始めて。AGENTS.md のヒアリングから、一問ずつ。
   ```

5. エージェントは `node tools/gate/cli.mjs init --root . --name <名前>` のあと、`next` の質問だけを聞く。

コピーの代わりに、このリポジトリを submodule や subtree で `vendor/mamestack` に置いてもよい。その場合、プロダクトの `AGENTS.md` は「`vendor/mamestack/AGENTS.md` に従い、ゲートは `node vendor/mamestack/tools/gate/cli.mjs` を、`--root` はこのプロダクトを指す」と一行で委譲する。状態ファイルはプロダクト側の `.mamestack/` にできる。テンプレートのパスは工場側を読む、と委譲の文に書く。

## 既にコードがあるリポジトリ

工程を途中から始めない。ヒアリングから記録し、今のコードがどのチケットの実装に相当するかを PR 文書で対応づける。検証動画は今の挙動に対して録る。デプロイは、資格情報と TODO の確認が終わるまで走らせない。

## 再現に要るもの

- Node.js 22.18 以上（`cf` の前提）。Astro を実際に作るなら、Astro 公式の前提は v22.23.4 以上で、奇数版は非対応。
- git
- 検証動画を録るマシンでは Playwright の Chromium
- Cloudflare へ出すときだけ、人間が `cf auth login` するか、`CLOUDFLARE_API_TOKEN` を渡す。トークンをコミットしない。
- Void アプリなら、そのプロダクトで `npm install -D void`。工場リポジトリ自体は Void を依存に入れない。

## エージェントが守るファイル

| パス | 役割 |
| --- | --- |
| `AGENTS.md` | 工程の本文 |
| `.cursor/rules/mamestack.mdc` | 常時の短い拘束 |
| `.cursor/skills/mamestack/SKILL.md` | スキルから本文への入口 |
| `templates/` | 各文書の見出し |
| `tools/gate/` | 飛ばせない状態機械 |
| `tools/verify-record/record.mjs` | 検証動画 |
| `docs/cloudflare-deploy.md` | 確認済みコマンドと TODO |
