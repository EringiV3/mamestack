import fs from "node:fs";
import path from "node:path";

export const PHASES = [
  "hearing",
  "prd",
  "mockup",
  "mode",
  "design",
  "tickets",
  "implement",
  "deploy",
  "done",
];

export const HEARING_KEYS = [
  "what",
  "who",
  "shape",
  "features",
  "data",
  "look",
  "domain",
];

export const QUESTIONS = {
  what: "何を作りますか。一文で、誰のどの用事を片づけるものか教えてください。",
  who: "それは誰が使いますか。使う人と、使わない人を一人ずつ挙げてください。自分だけなら、答えを「自分だけ」から始めてください。",
  shape:
    "ウェブサイト（Astro・保存しない静的サイト）なら static、ウェブアプリ（Void・操作や保存がある）なら dynamic と答えてください。保存があるなら dynamic です。",
  features:
    "機能は3つまでです。それぞれ名前と、v1 で入れるか後回し（later）かを決めてください。",
  data: "保存するデータは何ですか。無いなら、答えを「なし」から始めてください。",
  look: "見た目と雰囲気を教えてください。参考にしたいものや、避けたい印象があればそれも。",
  domain:
    "独自ドメインは使いますか。使うならドメイン名。使わないなら、答えを「なし」から始めてください。",
};

export const EMPTY_APP_TICKET_TITLE = "空のアプリをCloudflare本番に出す";

const MODE_QUESTION =
  "ここから先は、どちらにしますか。full-auto（この後はボットが進める。ただし破壊的なデータ操作と、費用のかかる操作は必ず確認する）か、approval（設計書、チケットの粒度、各 PR をあなたが承認する）か。";

function hasPrdHeading(body) {
  return /^#\s.*PRD/m.test(body);
}

function hasDesignHeading(body) {
  return /^#\s.*(?:設計書|Design Doc)/m.test(body);
}

/**
 * @param {never} value
 */
function assertNever(value) {
  throw new Error(`未処理の値です: ${JSON.stringify(value)}`);
}

export function createState(name) {
  return {
    version: 1,
    name,
    phase: "hearing",
    track: null,
    mode: null,
    hearing: {
      summaryPath: "docs/00-hearing.md",
      summaryAccepted: false,
      answers: {
        what: null,
        who: null,
        shape: null,
        features: null,
        data: null,
        look: null,
        domain: null,
      },
    },
    prd: { path: "docs/prd.md", approved: false, approvedBy: null },
    mockup: { path: "docs/mockup/index.html", approved: false, approvedBy: null },
    modeNotePath: "docs/03-mode.md",
    design: {
      path: "docs/design-doc.md",
      approved: false,
      approvedBy: null,
      framework: null,
      frameworkReason: "",
    },
    tickets: { confirmed: false, confirmedBy: null, items: [] },
    siteDelivery: null,
    deploy: {
      milestones: [
        {
          id: "v1",
          command: null,
          decision: null,
          reason: "",
          confirmedBy: null,
          executed: false,
        },
      ],
    },
  };
}

function isWebsite(state) {
  return state.hearing.answers.shape === "static" && isNone(state.hearing.answers.data);
}

function isPersonalUse(who) {
  return typeof who === "string" && who.trim().startsWith("自分だけ");
}

export function isNone(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return trimmed === "none" || trimmed.startsWith("なし");
}

function phaseIndex(phase) {
  const index = PHASES.indexOf(phase);
  if (index === -1) {
    throw new Error(`未知の phase です: ${phase}`);
  }
  return index;
}

function past(state, phase) {
  return phaseIndex(state.phase) > phaseIndex(phase);
}

export function firstMissingKey(state) {
  for (const key of HEARING_KEYS) {
    if (state.hearing.answers[key] === null) {
      return key;
    }
  }
  return null;
}

function assertUser(by, action) {
  if (by !== "user") {
    throw new Error(`${action} は利用者の明示的な返事が要ります。--by user 以外は受け付けません。`);
  }
}

function deployCommandFor(framework) {
  if (framework === "astro") {
    return "cf deploy";
  }
  if (framework === "void") {
    return "void deploy";
  }
  throw new Error("framework は astro か void です");
}

export function parseFeatures(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      '機能は JSON 配列で渡してください。例: [{"name":"営業時間","release":"v1"}]',
    );
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error("機能は1つ以上、3つまでです");
  }
  const features = value.map((feature) => {
    if (!feature || typeof feature.name !== "string" || feature.name.trim() === "") {
      throw new Error("機能名が空です");
    }
    if (feature.release !== "v1" && feature.release !== "later") {
      throw new Error("release は v1 か later です");
    }
    return { name: feature.name.trim(), release: feature.release };
  });
  if (!features.some((feature) => feature.release === "v1")) {
    throw new Error("v1 の機能が1つもありません");
  }
  const names = new Set(features.map((feature) => feature.name));
  if (names.size !== features.length) {
    throw new Error("機能名が重複しています");
  }
  return features;
}

function resolveInside(root, rel) {
  if (typeof rel !== "string" || rel.trim() === "" || path.isAbsolute(rel)) {
    throw new Error(`プロジェクト内の相対パスにしてください: ${rel}`);
  }
  const rootAbs = path.resolve(root);
  const abs = path.resolve(root, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error(`プロジェクトの外を指しています: ${rel}`);
  }
  return abs;
}

function readRequired(root, rel) {
  const abs = resolveInside(root, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`ファイルがありません: ${rel}`);
  }
  return fs.readFileSync(abs, "utf8");
}

function assertMockup(root, state) {
  const rel = state.mockup.path;
  const html = readRequired(root, rel);
  if (!/<!doctype html|<html[\s>]/i.test(html)) {
    throw new Error("モックの index.html は HTML 文書にしてください");
  }
  const dirRel = path.dirname(rel);
  const dirAbs = resolveInside(root, dirRel);
  for (const entry of fs.readdirSync(dirAbs, { recursive: true })) {
    const abs = path.join(dirAbs, String(entry));
    if (!fs.statSync(abs).isFile() || !/\.(html|css|js)$/i.test(abs)) {
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    if (/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']https?:/i.test(text)) {
      throw new Error("モックに外部の script や stylesheet は置けません");
    }
  }
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+\.html)["']/gi)) {
    const href = match[1].split(/[?#]/)[0];
    if (/^https?:/i.test(href)) {
      throw new Error("モックの画面リンクは docs/mockup の中だけです");
    }
    const target = path.posix.normalize(path.posix.join(dirRel.split(path.sep).join("/"), href));
    if (target !== dirRel && !target.startsWith(`${dirRel}/`)) {
      throw new Error("モックの画面リンクは docs/mockup の中だけです");
    }
    readRequired(root, target);
  }
}

export function answer(state, key, text) {
  if (state.phase !== "hearing") {
    throw new Error("ヒアリングは終わっています");
  }
  if (!HEARING_KEYS.includes(key)) {
    throw new Error(`未知の質問です: ${key}`);
  }
  const expected = firstMissingKey(state);
  if (expected === null) {
    throw new Error("質問は出尽くしています。要求まとめを書いて accept-summary してください");
  }
  if (key !== expected) {
    throw new Error(`今聞けるのは ${expected} だけです`);
  }
  const answers = { ...state.hearing.answers };
  if (key === "shape") {
    const shape = text.trim();
    if (shape !== "static" && shape !== "dynamic") {
      throw new Error("shape は static か dynamic です");
    }
    answers.shape = shape;
  } else if (key === "features") {
    answers.features = parseFeatures(text);
  } else {
    const trimmed = text.trim();
    if (trimmed.length < 4) {
      throw new Error("答えが短すぎます");
    }
    if ((key === "data" || key === "domain") && !isNone(trimmed) && trimmed.length < 4) {
      throw new Error("答えが短すぎます");
    }
    answers[key] = trimmed;
  }
  return {
    ...state,
    hearing: { ...state.hearing, answers },
  };
}

export function acceptSummary(state, root, by) {
  if (state.phase !== "hearing") {
    throw new Error("要求まとめを受理できるのは hearing の間だけです");
  }
  if (firstMissingKey(state) !== null) {
    throw new Error("まだ聞いていない質問があります");
  }
  const summary = readRequired(root, state.hearing.summaryPath);
  assertSummaryContainsAnswers(summary, state);
  if (isWebsite(state)) {
    if (by !== "bot") {
      throw new Error("サイトは承認を待たず、accept-summary --by bot です");
    }
    return {
      ...state,
      phase: "implement",
      track: "site",
      hearing: { ...state.hearing, summaryAccepted: true },
      deploy: {
        milestones: state.deploy.milestones.map((milestone) =>
          milestone.id === "v1" ? { ...milestone, command: "npm run deploy" } : milestone,
        ),
      },
    };
  }
  assertUser(by, "要求まとめの受理");
  return {
    ...state,
    phase: "prd",
    track: "app",
    hearing: { ...state.hearing, summaryAccepted: true },
  };
}

function assertSummaryContainsAnswers(summary, state) {
  if (!summary.includes("# 要求まとめ")) {
    throw new Error("要求まとめに見出し「# 要求まとめ」がありません");
  }
  const answers = state.hearing.answers;
  for (const key of ["what", "who", "shape", "data", "look", "domain"]) {
    if (!summary.includes(answers[key])) {
      throw new Error(`要求まとめに ${key} の答えが入っていません`);
    }
  }
  for (const feature of answers.features) {
    if (!summary.includes(feature.name) || !summary.includes(feature.release)) {
      throw new Error(`要求まとめに機能「${feature.name}」がありません`);
    }
  }
}

export function approvePrd(state, root, by) {
  assertUser(by, "PRD の承認");
  if (state.phase !== "prd") {
    throw new Error("PRD を承認できるのは prd の間だけです");
  }
  const body = readRequired(root, state.prd.path);
  if (!hasPrdHeading(body)) {
    throw new Error("PRD の見出しに PRD がありません");
  }
  if (!body.includes(state.name) && !body.includes(state.hearing.answers.what)) {
    throw new Error("PRD がヒアリングの内容と繋がっていません");
  }
  for (const feature of state.hearing.answers.features) {
    if (!body.includes(feature.name)) {
      throw new Error(`PRD に機能「${feature.name}」がありません`);
    }
  }
  if (isPersonalUse(state.hearing.answers.who) && !body.includes("該当なし（自分用）")) {
    throw new Error("自分用の PRD には、聞かない節へ「該当なし（自分用）」と書いてください");
  }
  return {
    ...state,
    phase: "mockup",
    prd: { ...state.prd, approved: true, approvedBy: "user" },
  };
}

export function approveMockup(state, root, by) {
  assertUser(by, "モックの承認");
  if (state.phase !== "mockup") {
    throw new Error("モックを承認できるのは mockup の間だけです");
  }
  assertMockup(root, state);
  return {
    ...state,
    phase: "mode",
    mockup: { ...state.mockup, approved: true, approvedBy: "user" },
  };
}

export function setMode(state, root, mode, by) {
  assertUser(by, "モードの選択");
  if (state.phase !== "mode") {
    throw new Error("モードを決められるのは、モック承認の直後だけです");
  }
  if (mode !== "full-auto" && mode !== "approval") {
    throw new Error("mode は full-auto か approval です");
  }
  const note = readRequired(root, state.modeNotePath);
  if (!note.includes(mode)) {
    throw new Error(`docs/03-mode.md に ${mode} と書いてから set-mode してください`);
  }
  return { ...state, phase: "design", mode };
}

export function approveDesign(state, root, by, framework, reason) {
  if (state.phase !== "design") {
    throw new Error("設計書を確定できるのは design の間だけです");
  }
  if (state.mode === "approval") {
    assertUser(by, "設計書の承認");
  } else if (by !== "user" && by !== "bot") {
    throw new Error("--by は user か bot です");
  }
  if (framework !== "astro" && framework !== "void") {
    throw new Error("framework は astro か void です");
  }
  const shape = state.hearing.answers.shape;
  const storesData = !isNone(state.hearing.answers.data);
  if (shape === "dynamic" && framework !== "void") {
    throw new Error("アプリケーションは Void です。Astro はサイトに使います");
  }
  if (shape === "static" && !storesData && framework !== "astro") {
    throw new Error("保存のない静的サイトは Astro です");
  }
  if (shape === "static" && storesData) {
    if (framework !== "void") {
      throw new Error("保存があるならアプリケーションです。Void を選んでください");
    }
    if (typeof reason !== "string" || reason.trim().length < 8) {
      throw new Error("静的と答えたのに保存があるため、Void を選ぶ理由が要ります");
    }
  }
  if (typeof reason !== "string" || reason.trim().length < 8) {
    throw new Error("フレームワークを選んだ理由を書いてください");
  }
  const body = readRequired(root, state.design.path);
  if (!hasDesignHeading(body)) {
    throw new Error("設計書の見出しに「設計書」または「Design Doc」がありません");
  }
  const frameworkWord = framework === "astro" ? "Astro" : "Void";
  if (!body.includes(frameworkWord)) {
    throw new Error(`設計書に ${frameworkWord} と書いてください`);
  }
  if (!body.includes(reason.trim())) {
    throw new Error("設計書に、選定理由と同じ文を入れてください");
  }
  for (const feature of state.hearing.answers.features) {
    if (feature.release === "v1" && !body.includes(feature.name)) {
      throw new Error(`設計書に v1 機能「${feature.name}」がありません`);
    }
  }
  const command = deployCommandFor(framework);
  return {
    ...state,
    phase: "tickets",
    design: {
      ...state.design,
      approved: true,
      approvedBy: by,
      framework,
      frameworkReason: reason.trim(),
    },
    deploy: {
      milestones: state.deploy.milestones.map((milestone) =>
        milestone.id === "v1" ? { ...milestone, command } : milestone,
      ),
    },
  };
}

export function addTicket(state, root, ticket) {
  if (state.phase !== "tickets") {
    throw new Error("チケットを足せるのは tickets の間だけです");
  }
  if (!/^T[1-9][0-9]*$/.test(ticket.id)) {
    throw new Error("チケット ID は T1 の形です");
  }
  if (state.tickets.items.some((item) => item.id === ticket.id)) {
    throw new Error(`チケット ${ticket.id} は既にあります`);
  }
  if (ticket.size !== "S" && ticket.size !== "M") {
    throw new Error("サイズ L は分割してから登録します。S か M だけです");
  }
  const first = state.tickets.items.length === 0;
  if (first) {
    if (ticket.id !== "T1" || ticket.title !== EMPTY_APP_TICKET_TITLE) {
      throw new Error(`最初のチケットは T1「${EMPTY_APP_TICKET_TITLE}」です`);
    }
  } else if (ticket.title === EMPTY_APP_TICKET_TITLE) {
    throw new Error("空アプリの本番公開は T1 だけです");
  } else {
    const features = state.hearing.answers.features;
    const feature = features.find((item) => item.name === ticket.feature);
    if (!feature) {
      throw new Error("feature はヒアリングの機能名と一致させてください");
    }
    if (feature.release !== "v1") {
      throw new Error(`「${feature.name}」は later です。v1 のチケットにしません`);
    }
  }
  const body = readRequired(root, ticket.path);
  if (!body.includes(ticket.title) || !body.includes("受入条件") || !body.includes(ticket.id)) {
    throw new Error("チケットファイルに ID、タイトル、受入条件を入れてください");
  }
  return {
    ...state,
    tickets: {
      ...state.tickets,
      items: [
        ...state.tickets.items,
        {
          id: ticket.id,
          title: ticket.title,
          size: ticket.size,
          feature: ticket.feature,
          path: ticket.path,
          pr: null,
        },
      ],
    },
  };
}

export function confirmTickets(state, by) {
  if (state.phase !== "tickets") {
    throw new Error("粒度を確認できるのは tickets の間だけです");
  }
  if (state.mode === "approval") {
    assertUser(by, "チケット粒度の確認");
  } else if (by !== "user" && by !== "bot") {
    throw new Error("--by は user か bot です");
  }
  if (state.tickets.items.length < 1) {
    throw new Error("チケットが1枚もありません");
  }
  for (const feature of state.hearing.answers.features) {
    if (feature.release !== "v1") {
      continue;
    }
    const covered = state.tickets.items.some((item) => item.feature === feature.name);
    if (!covered) {
      throw new Error(`v1 機能「${feature.name}」をカバーするチケットがありません`);
    }
  }
  return {
    ...state,
    phase: "implement",
    tickets: { ...state.tickets, confirmed: true, confirmedBy: by },
  };
}

function assertVideo(root, rel) {
  const abs = resolveInside(root, rel);
  if (!abs.endsWith(".webm") && !abs.endsWith(".mp4")) {
    throw new Error("検証動画は .webm か .mp4 です");
  }
  if (!fs.existsSync(abs)) {
    throw new Error(`検証動画がありません: ${rel}`);
  }
  const buf = fs.readFileSync(abs);
  if (buf.length < 1024) {
    throw new Error(`検証動画が小さすぎます: ${rel}`);
  }
  const webm =
    buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  const mp4 = buf.subarray(4, 8).toString("ascii") === "ftyp";
  if (!webm && !mp4) {
    throw new Error(`検証動画の形式を確認できません: ${rel}`);
  }
}

function assertPrVideo(root, prPath, videoPath) {
  const body = readRequired(root, prPath);
  const videoLine = `検証動画: ${videoPath}`;
  if (!body.includes(videoLine)) {
    throw new Error(`PR に「${videoLine}」の行がありません`);
  }
  if (!body.includes("終了コード: 0")) {
    throw new Error("PR に「終了コード: 0」がありません。失敗した録画は完了になりません");
  }
  if (!body.includes("録画コマンド:")) {
    throw new Error("PR に録画コマンドがありません");
  }
  assertVideo(root, videoPath);
  return body;
}

export function attachPr(state, root, ticketId, prPath, videoPath) {
  if (state.phase !== "implement") {
    throw new Error("PR を付けられるのは implement の間だけです");
  }
  if (state.track === "site") {
    if (state.siteDelivery) {
      throw new Error("サイトの PR は既に付いています");
    }
    assertPrVideo(root, prPath, videoPath);
    return {
      ...state,
      phase: "deploy",
      siteDelivery: { path: prPath, video: videoPath },
    };
  }
  const index = state.tickets.items.findIndex((item) => item.id === ticketId);
  if (index === -1) {
    throw new Error(`チケットがありません: ${ticketId}`);
  }
  const ticket = state.tickets.items[index];
  if (ticket.pr) {
    throw new Error(`${ticketId} には既に PR があります`);
  }
  const body = assertPrVideo(root, prPath, videoPath);
  if (!body.includes(ticketId)) {
    throw new Error("PR にチケット ID がありません");
  }
  const items = state.tickets.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, pr: { path: prPath, video: videoPath } } : item,
  );
  const complete = items.every((item) => item.pr);
  return {
    ...state,
    phase: complete ? "deploy" : "implement",
    tickets: { ...state.tickets, items },
  };
}

export function confirmDeploy(state, milestoneId, decision, by, reason) {
  assertUser(by, "デプロイの確認");
  if (state.phase !== "deploy") {
    throw new Error("デプロイを確認できるのは、全チケットの検証動画が揃ってからです");
  }
  if (decision !== "run" && decision !== "skip") {
    throw new Error("decision は run か skip です");
  }
  if (typeof reason !== "string" || reason.trim().length < 8) {
    throw new Error("確認の理由を書いてください");
  }
  const milestone = state.deploy.milestones.find((item) => item.id === milestoneId);
  if (!milestone) {
    throw new Error(`マイルストーンがありません: ${milestoneId}`);
  }
  if (milestone.decision) {
    throw new Error(`${milestoneId} は確認済みです`);
  }
  if (!milestone.command) {
    throw new Error("デプロイコマンドが空です");
  }
  if (/wrangler/i.test(milestone.command) && state.track !== "site") {
    throw new Error("アプリのデプロイコマンドに Wrangler は使えません");
  }
  const milestones = state.deploy.milestones.map((item) =>
    item.id === milestoneId
      ? {
          ...item,
          decision,
          reason: reason.trim(),
          confirmedBy: "user",
          executed: false,
        }
      : item,
  );
  const resolved = milestones.every((item) => item.decision === "skip" || item.executed);
  return {
    ...state,
    phase: resolved ? "done" : "deploy",
    deploy: { milestones },
  };
}

export function markDeploy(state, milestoneId, exitCode) {
  if (state.phase !== "deploy" && state.phase !== "done") {
    throw new Error("実行結果を記録できるのはデプロイ確認の後です");
  }
  const milestone = state.deploy.milestones.find((item) => item.id === milestoneId);
  if (!milestone || milestone.decision !== "run" || milestone.confirmedBy !== "user") {
    throw new Error("利用者が run を確認したマイルストーンだけ記録できます");
  }
  if (exitCode !== 0) {
    throw new Error("終了コード 0 以外は実行済みにしません");
  }
  const milestones = state.deploy.milestones.map((item) =>
    item.id === milestoneId ? { ...item, executed: true } : item,
  );
  const resolved = milestones.every((item) => item.decision === "skip" || item.executed);
  return {
    ...state,
    phase: resolved ? "done" : "deploy",
    deploy: { milestones },
  };
}

export function classifyCommand(command, options = {}) {
  const track = options.track ?? null;
  const normalized = command.trim();
  if (/wrangler/i.test(normalized)) {
    if (track !== "site") {
      return { class: "forbidden", reason: "アプリは Wrangler を使いません。サイト（Astro）だけが使います" };
    }
    if (/\bdeploy\b/.test(normalized) || /\b(delete|secret)\b/i.test(normalized) || /\b--force\b/.test(normalized)) {
      return { class: "confirm", reason: "サイトの Wrangler デプロイは公開であり、費用がかかることがあります" };
    }
    return { class: "allow", reason: "" };
  }
  const confirmers = [
    { re: /\bnpm\s+run\s+deploy\b/, reason: "npm run deploy は公開であり、費用がかかることがあります" },
    { re: /\bcf\s+deploy\b/, reason: "cf deploy は公開であり、費用がかかることがあります" },
    { re: /\bvoid\s+deploy\b/, reason: "void deploy は資源の作成とマイグレーションを伴います" },
    { re: /\bvoid\s+secret\s+put\b/, reason: "本番シークレットの書き込みです" },
    { re: /\bvoid\s+db\s+restore\b/, reason: "データベースの復元は破壊的です" },
    { re: /\bvoid\s+project\s+rollback\b/, reason: "ロールバックです" },
    { re: /\bcf\s+\S+\s+delete\b/, reason: "削除です" },
    { re: /\bcf\s+(d1|kv|r2)\s+create\b/, reason: "資源の作成です。費用がかかることがあります" },
    { re: /\b--force\b/, reason: "--force は破壊的操作に使われます" },
    { re: /\bpurchase\b/i, reason: "購入は費用がかかります" },
    { re: /\bregistrar\b/i, reason: "ドメインの購入や移管は費用がかかることがあります" },
  ];
  for (const confirmer of confirmers) {
    if (confirmer.re.test(normalized)) {
      return { class: "confirm", reason: confirmer.reason };
    }
  }
  if (
    /\bcf\s+d1\s+query\b/i.test(normalized) &&
    /\b(drop|delete|update|insert|alter|truncate)\b/i.test(normalized)
  ) {
    return { class: "confirm", reason: "D1 への書き込み SQL です" };
  }
  return { class: "allow", reason: "" };
}

export function nextAction(state) {
  switch (state.phase) {
    case "hearing": {
      const key = firstMissingKey(state);
      if (key) {
        return {
          code: "ask",
          message: `この質問だけを聞いてください。まとめたり、先の質問を足したりしないでください。\n\n${QUESTIONS[key]}`,
        };
      }
      if (isWebsite(state)) {
        return {
          code: "write-summary",
          message:
            "ウェブサイトです。PRD、モック、モード、設計書、チケット分割は飛ばします。七つの答えを docs/00-hearing.md（見出しは「# 要求まとめ」）に短く残し、承認は待たずに accept-summary --by bot を実行します。",
        };
      }
      return {
        code: "write-summary",
        message:
          "ウェブアプリです。7つの答えを一枚の要求まとめ（docs/00-hearing.md、見出しは「# 要求まとめ」）に書き、利用者に見せて受理を待ってください。保存があると答えた静的サイトもこちらです。受理されたら accept-summary --by user を実行します。",
      };
    }
    case "prd":
      return {
        code: "write-prd",
        message:
          "templates/prd.md を docs/prd.md に写して埋めてください。init で置いてあればそれを使います。エレベーターピッチ、ターゲットと課題、成功指標、機能要件（P0/P1/P2/Won't）、画面フロー、マネタイズ・コスト、GTM を埋めます。答えが出ている項目は聞き直さず、不足だけを1回3問まで聞いてください。機能は最大3つです。削らず、不要な箇所は「該当なし」と書きます。who が「自分だけ」で始まるときは、収益モデル、プライシング、GTM、既存サービスとの差別化、成功指標の収益・グロース行は聞かないで「該当なし（自分用）」と書きます。インフラ許容コストは Cloudflare 無料枠を前提に埋めます。テンプレートの見出しは残します。全文を見せ、OK なら approve-prd --by user を実行します。",
      };
    case "mockup":
      return {
        code: "write-mockup",
        message:
          "PRD の画面フローと P0 の画面だけを、依存なしの HTML と CSS で docs/mockup/ に置いてください。index.html から各画面へリンクします。JS は画面切替など最小限、データはダミーです。スマホ幅と PC 幅のスクショを撮り、利用者に見せてください。修正が来たら直して再提示し、仕様に関わる変更は docs/prd.md にも反映します。機能は足しません。4つ目は次の版のメモとして PRD の Won't に残します。これは全体のイメージと大まかな UI のすり合わせで、見た目の正にはしません。OK はモードに関係なく利用者からもらいます。OK なら approve-mockup --by user を実行します。",
      };
    case "mode":
      return {
        code: "ask-mode",
        message: `この質問を一度だけ聞いてください。\n\n${MODE_QUESTION}`,
      };
    case "design":
      return {
        code: "write-design",
        message:
          "templates/design-doc.md を docs/design-doc.md に写して埋めてください。init で置いてあればそれを使います。各セクションを埋め、利用者にしか決められないこと（認証、課金、ドメインなど）だけ聞いてください。答えが出ている項目は聞き直さない。削らず、不要な箇所は「該当なし」と書きます。モックは参考程度に見てください。見た目の正にはしません。サイトは Astro、アプリケーションは Void、公開先は Cloudflare です。テンプレートの文言は残します。approval なら利用者の OK を待って approve-design --by user。full-auto なら approve-design --by bot。選定理由は設計書と同じ文を --reason に渡します。",
      };
    case "tickets":
      return {
        code: "write-tickets",
        message:
          "最初のチケットは必ず T1「空のアプリをCloudflare本番に出す」です。リポジトリ作成、Void 導入、必要な D1 等の作成とバインディング、cf または Void CLI でのデプロイ、本番 URL の表示確認を受入条件にします。資源の作成とデプロイは利用者の確認が要ります。その後に v1 の機能チケットを足します。サイズ L は禁止です。各 PR のあと本番に出せる状態を保ちます。approval なら粒度の OK を待って confirm-tickets --by user。full-auto なら confirm-tickets --by bot。",
      };
    case "implement": {
      if (state.track === "site") {
        return {
          code: "implement",
          message:
            "サイトの実装です。最初に空ページを npm run deploy（中身は固定バージョンの Wrangler）で本番に出します。実行前に guard --root <プロダクト> --command \"npm run deploy\" と利用者の確認が要ります。出た本番 URL を見てから中身を作り、PR を1枚と検証動画を残して attach-pr します。アプリに Wrangler は使いません。",
        };
      }
      const open = state.tickets.items.find((item) => !item.pr);
      return {
        code: "implement",
        message: `チケット ${open?.id ?? "?"} だけを実装し、PR を1枚作り、検証動画を録画してください。動画の無い PR は完了になりません。各 PR のあと本番に出せる状態を保ちます。デプロイそのものは利用者の確認が要ります。モックとの差分確認はしません。approval なら PR ごとに利用者の OK を取ります。`,
      };
    }
    case "deploy":
      return {
        code: "confirm-deploy",
        message:
          "デプロイは費用と公開を伴います。サイトもアプリも、本番 URL で表示を確認します。必ず利用者に確認してください。公開は npm run deploy です。サイトの script は固定バージョンの Wrangler、アプリは Void CLI と cf です。docs/cloudflare-deploy.md の未検証項目が残っているコマンドは実行せず、その旨を伝えて skip か待機を選んでもらいます。確認後に confirm-deploy --by user。",
      };
    case "done":
      return { code: "done", message: "このプロダクトの mamestack 工程は閉じました。" };
    default:
      return assertNever(state.phase);
  }
}

export function validate(state, root) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (state.version !== 1) {
    fail("version は 1 です");
  }
  if (!PHASES.includes(state.phase)) {
    fail(`未知の phase です: ${state.phase}`);
    return errors;
  }
  if (state.phase === "hearing" || state.phase === "prd" || state.phase === "mockup") {
    if (state.mode !== null) {
      fail("モードはモック承認の後にだけ決まります");
    }
  } else if (state.phase === "mode") {
    if (state.mode !== null) {
      fail("mode フェーズでは mode はまだ null です");
    }
  } else if (state.track === "site") {
    if (state.mode !== null) {
      fail("サイトにモードはありません");
    }
  } else if (state.mode !== "full-auto" && state.mode !== "approval") {
    fail("mode が決まっていません");
  }

  let seenNull = false;
  for (const key of HEARING_KEYS) {
    const value = state.hearing.answers[key];
    if (value === null) {
      seenNull = true;
    } else if (seenNull) {
      fail(`${key} が、前の質問より先に埋まっています`);
    }
  }
  if (past(state, "hearing")) {
    if (firstMissingKey(state) !== null || !state.hearing.summaryAccepted) {
      fail("ヒアリングが閉じる前に先へ進んでいます");
    } else {
      try {
        assertSummaryContainsAnswers(readRequired(root, state.hearing.summaryPath), state);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (state.track !== "site" && past(state, "prd")) {
    if (!state.prd.approved) {
      fail("PRD が承認されていません");
    } else {
      try {
        const body = readRequired(root, state.prd.path);
        if (!hasPrdHeading(body)) {
          fail("PRD の見出しがありません");
        }
        for (const feature of state.hearing.answers.features) {
          if (!body.includes(feature.name)) {
            fail(`PRD から機能「${feature.name}」が消えました`);
          }
        }
        if (isPersonalUse(state.hearing.answers.who) && !body.includes("該当なし（自分用）")) {
          fail("自分用の PRD に「該当なし（自分用）」がありません");
        }
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  // モック工程の前に閉じたサンプルは mockup キーを持たない。
  if (state.track !== "site" && state.mockup && past(state, "mockup")) {
    if (!state.mockup.approved || state.mockup.approvedBy !== "user") {
      fail("モックが利用者に承認されていません");
    } else {
      try {
        assertMockup(root, state);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (state.track !== "site" && past(state, "mode")) {
    try {
      const note = readRequired(root, state.modeNotePath);
      if (!note.includes(state.mode)) {
        fail("モードの記録が状態と違います");
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  if (state.track !== "site" && past(state, "design")) {
    if (!state.design.approved || !state.design.framework) {
      fail("設計書が確定していません");
    } else {
      try {
        const body = readRequired(root, state.design.path);
        const frameworkWord = state.design.framework === "astro" ? "Astro" : "Void";
        if (state.design.frameworkReason.trim().length < 8) {
          fail("選定理由が短すぎます");
        }
        if (!hasDesignHeading(body) || !body.includes(frameworkWord) || !body.includes(state.design.frameworkReason)) {
          fail("設計書が確定時の内容と違います");
        }
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (state.track !== "site" && past(state, "tickets") && !state.tickets.confirmed) {
    fail("チケット粒度が確認されていません");
  }
  if (state.track === "app" && state.tickets.items.length > 0) {
    const first = state.tickets.items[0];
    if (first.id !== "T1" || first.title !== EMPTY_APP_TICKET_TITLE) {
      fail(`最初のチケットは T1「${EMPTY_APP_TICKET_TITLE}」です`);
    }
  }
  if (past(state, "implement")) {
    if (state.track === "site") {
      if (!state.siteDelivery?.video) {
        fail("検証動画の無いサイト実装のままデプロイへ進んでいます");
      } else {
        try {
          assertPrVideo(root, state.siteDelivery.path, state.siteDelivery.video);
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
      }
    } else if (state.tickets.items.length < 1 || state.tickets.items.some((item) => !item.pr)) {
      fail("検証動画の無いチケットが残ったままデプロイへ進んでいます");
    }
  }
  if (state.phase === "implement" && state.track === "site" && state.siteDelivery) {
    fail("サイトの PR が付いているのに phase が implement のままです");
  }
  if (
    state.phase === "implement" &&
    state.track !== "site" &&
    state.tickets.items.every((item) => item.pr) &&
    state.tickets.items.length > 0
  ) {
    fail("全 PR が揃っているのに phase が implement のままです");
  }
  if (state.phase === "done") {
    const pending = state.deploy.milestones.some(
      (item) => item.decision === null || (item.decision === "run" && !item.executed),
    );
    if (pending) {
      fail("未確認のデプロイが残ったまま done です");
    }
  }
  for (const item of state.tickets.items) {
    try {
      const body = readRequired(root, item.path);
      if (!body.includes(item.id) || !body.includes(item.title) || !body.includes("受入条件")) {
        fail(`${item.id} のチケットファイルが足りません`);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
    if (item.pr) {
      try {
        const body = readRequired(root, item.pr.path);
        if (!body.includes(`検証動画: ${item.pr.video}`) || !body.includes("終了コード: 0")) {
          fail(`${item.id} の PR に検証動画か終了コードがありません`);
        }
        assertVideo(root, item.pr.video);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  for (const milestone of state.deploy.milestones) {
    if (milestone.command && /wrangler/i.test(milestone.command) && state.track !== "site") {
      fail("デプロイコマンドに Wrangler が含まれています");
    }
    if ((milestone.decision || milestone.executed) && milestone.confirmedBy !== "user") {
      fail(`${milestone.id} をボットだけで確認しています`);
    }
    if (milestone.executed && milestone.decision !== "run") {
      fail(`${milestone.id} は run の確認なしに実行済みです`);
    }
  }
  return errors;
}
