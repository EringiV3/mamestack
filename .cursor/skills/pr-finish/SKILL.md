---
name: pr-finish
description: Finish one mamestack pull request. Use when writing the PR body, checking the verification video, running the gate, or keeping a change to a single ticket and a small diff.
---

# pr-finish

本文の体裁は [templates/pull-request.md](../../../templates/pull-request.md)。チケットと動画の規則は [AGENTS.md](../../../AGENTS.md) の実装の節と [docs/verification-video.md](../../../docs/verification-video.md)。

1. チケット 1 枚につき PR 1 枚。開いているチケット以外を同じ差分に入れない。
2. 検証動画は [verify-record](../verify-record/SKILL.md) で録り、終了コード 0 の三行とファイルを付ける。
3. `node tools/gate/cli.mjs check --root <root>` が成功してから完了とする。`approval` では attach の前に本文を利用者へ見せる。順序は [AGENTS.md](../../../AGENTS.md)。
4. 差分は、そのチケットの受入条件に要る変更だけにする。関係のない整形やファイルを足さない。
