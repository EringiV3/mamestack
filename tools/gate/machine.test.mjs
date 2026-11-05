import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acceptSummary,
  addTicket,
  answer,
  approveDesign,
  approveMockup,
  approvePrd,
  attachPr,
  classifyCommand,
  confirmDeploy,
  confirmTickets,
  markDeploy,
  createState,
  EMPTY_APP_TICKET_TITLE,
  nextAction,
  setMode,
  validate,
} from "./machine.mjs";

const FEATURES = [
  { name: "営業時間を表示する", release: "v1" },
  { name: "売り切れをスマホで更新する", release: "later" },
];

const ANSWERS = {
  what: "店先の客が今日の営業時間を一目で見るページ",
  who: "使う人は朝に通りかかる客。使わない人は仕込み中の店主。",
  shape: "static",
  data: "なし。営業時間はページに書く。",
  look: "生成りの紙と墨。写真は使わない。",
  domain: "なし。共有できる URL で足りる。",
};

function write(root, rel, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function fakeVideo(root, rel) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const buf = Buffer.alloc(1200);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  fs.writeFileSync(abs, buf);
}

function hear(state) {
  let current = answer(state, "what", ANSWERS.what);
  current = answer(current, "who", ANSWERS.who);
  current = answer(current, "shape", ANSWERS.shape);
  current = answer(current, "features", JSON.stringify(FEATURES));
  current = answer(current, "data", ANSWERS.data);
  current = answer(current, "look", ANSWERS.look);
  current = answer(current, "domain", ANSWERS.domain);
  return current;
}

function summaryBody() {
  return `# 要求まとめ

${ANSWERS.what}

${ANSWERS.who}

${ANSWERS.shape}

${FEATURES[0].name} ${FEATURES[0].release}

${FEATURES[1].name} ${FEATURES[1].release}

${ANSWERS.data}

${ANSWERS.look}

${ANSWERS.domain}
`;
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mamestack-"));
}

test("質問は一つずつで、先のキーは受け付けない", () => {
  const state = createState("demo");
  assert.throws(() => answer(state, "who", ANSWERS.who), /what/);
  const once = answer(state, "what", ANSWERS.what);
  assert.equal(once.hearing.answers.what, ANSWERS.what);
  assert.equal(once.hearing.answers.who, null);
});

test("機能は1つ以上で、v1 が一つは要る。個数の上限はない", () => {
  let state = answer(createState("demo"), "what", ANSWERS.what);
  state = answer(state, "who", ANSWERS.who);
  state = answer(state, "shape", "static");
  assert.throws(
    () => answer(state, "features", JSON.stringify([{ name: "だけ", release: "later" }])),
    /v1/,
  );
  assert.throws(() => answer(state, "features", "[]"), /1つ以上/);
  const four = [
    { name: "a", release: "v1" },
    { name: "b", release: "later" },
    { name: "c", release: "later" },
    { name: "d", release: "later" },
  ];
  const accepted = answer(state, "features", JSON.stringify(four));
  assert.equal(accepted.hearing.answers.features.length, 4);
});

test("PRD の前にモードは決まらず、承認は利用者だけ", () => {
  const root = tempRoot();
  let state = hearDynamic(createState("demo"));
  write(root, state.hearing.summaryPath, dynamicSummary());
  assert.throws(() => acceptSummary(state, root, "bot"), /利用者/);
  state = acceptSummary(state, root, "user");
  assert.equal(state.phase, "prd");
  assert.equal(state.track, "app");
  assert.throws(() => setMode(state, root, "full-auto", "user"), /モック/);
});

test("モックの OK は利用者だけで、モードより前", () => {
  const root = tempRoot();
  let state = hearDynamic(createState("demo"));
  write(root, state.hearing.summaryPath, dynamicSummary());
  state = acceptSummary(state, root, "user");
  write(root, state.prd.path, `# PRD\n\ndemo\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`);
  state = approvePrd(state, root, "user");
  assert.equal(state.phase, "mockup");
  write(
    root,
    state.mockup.path,
    '<!doctype html><html><head><link rel="stylesheet" href="https://example.com/a.css"></head><body></body></html>\n',
  );
  assert.throws(() => approveMockup(state, root, "user"), /外部/);
  write(root, state.mockup.path, "<!doctype html><html><body><p>demo</p></body></html>\n");
  assert.throws(() => approveMockup(state, root, "bot"), /利用者/);
  state = approveMockup(state, root, "user");
  assert.equal(state.phase, "mode");
  assert.equal(state.mockup.approvedBy, "user");
});

test("approval ではボットが設計書を確定できない", () => {
  const root = tempRoot();
  const ready = readyForDesign(root, "approval");
  const reason = "保存のない静的サイトなので Astro を使う";
  write(root, ready.design.path, designBody(reason));
  assert.throws(
    () => approveDesign(ready, root, "bot", "astro", reason),
    /利用者/,
  );
});

test("full-auto でもデプロイ確認はボットだけでは通らない", () => {
  const root = tempRoot();
  const deploying = readyToDeploy(root, "full-auto");
  assert.equal(deploying.phase, "deploy");
  assert.throws(
    () => confirmDeploy(deploying, "v1", "run", "bot", "ボットが公開すると決めた"),
    /利用者/,
  );
  const withEmpty = confirmDeploy(deploying, "empty", "skip", "user", "テストでは空の公開を省略する");
  assert.equal(withEmpty.phase, "deploy");
  const done = confirmDeploy(withEmpty, "v1", "skip", "user", "アカウントが無いので公開しない");
  assert.equal(done.phase, "done");
  assert.deepEqual(validate(done, root), []);
});

test("動画の無い PR は付けられない", () => {
  const root = tempRoot();
  const state = readyToImplement(root, "approval");
  write(
    root,
    "docs/prs/T1.md",
    "T1\n検証動画: recordings/t1.webm\n録画コマンド: node record.mjs\n終了コード: 0\n",
  );
  assert.throws(() => attachPr(state, root, "T1", "docs/prs/T1.md", "recordings/t1.webm"), /ありません/);
});

test("later の機能はチケットにできない", () => {
  const root = tempRoot();
  let state = readyForTickets(root, "approval");
  write(root, "docs/tickets/T1.md", `T1\n${EMPTY_APP_TICKET_TITLE}\n受入条件\n本番 URL に空のアプリが出る\n`);
  state = addTicket(state, root, {
    id: "T1",
    title: EMPTY_APP_TICKET_TITLE,
    size: "S",
    feature: "本番公開",
    path: "docs/tickets/T1.md",
  });
  write(root, "docs/tickets/T9.md", "T9\n売り切れをスマホで更新する\n受入条件\n");
  assert.throws(
    () =>
      addTicket(state, root, {
        id: "T9",
        title: "売り切れをスマホで更新する",
        size: "S",
        feature: "売り切れをスマホで更新する",
        path: "docs/tickets/T9.md",
      }),
    /later/,
  );
});

test("動的アプリに Astro は選べない", () => {
  const root = tempRoot();
  let state = hearDynamic(createState("app"));
  write(root, state.hearing.summaryPath, dynamicSummary());
  state = acceptSummary(state, root, "user");
  write(root, state.prd.path, `# PRD\n\napp\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`);
  state = approvePrd(state, root, "user");
  write(root, state.mockup.path, "<!doctype html><html><body><p>app</p></body></html>\n");
  state = approveMockup(state, root, "user");
  write(root, state.modeNotePath, "approval を選ぶ。\n");
  state = setMode(state, root, "approval", "user");
  const reason = "保存があるのでアプリケーションとして扱う";
  write(root, state.design.path, `# 設計書\n\nAstro\n${reason}\n営業時間を表示する\n`);
  assert.throws(() => approveDesign(state, root, "user", "astro", reason), /Void/);
});

test("新しいテンプレートの見出しでも PRD と設計書を承認できる", () => {
  const root = tempRoot();
  let state = hearDynamic(createState("demo"));
  write(root, state.hearing.summaryPath, dynamicSummary());
  state = acceptSummary(state, root, "user");
  write(
    root,
    state.prd.path,
    `# demo PRD（要求仕様書）\n\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`,
  );
  state = approvePrd(state, root, "user");
  write(root, state.mockup.path, "<!doctype html><html><body><p>demo</p></body></html>\n");
  state = approveMockup(state, root, "user");
  write(root, state.modeNotePath, "approval\n");
  state = setMode(state, root, "approval", "user");
  const reason = "保存があるのでアプリケーションとして扱う";
  write(root, state.design.path, `# demo Design Doc\n\nVoid\n${reason}\n営業時間を表示する\n`);
  const approved = approveDesign(state, root, "user", "void", reason);
  assert.equal(approved.phase, "tickets");
  assert.deepEqual(validate(approved, root), []);
});

test("サイトは承認を待たず実装に入り、PR の動画が要る", () => {
  const root = tempRoot();
  let state = hear(createState("demo"));
  write(root, state.hearing.summaryPath, summaryBody());
  assert.throws(() => acceptSummary(state, root, "user"), /bot/);
  state = acceptSummary(state, root, "bot");
  assert.equal(state.phase, "implement");
  assert.equal(state.track, "site");
  assert.equal(state.deploy.milestones[0].command, "npm run deploy");
  write(
    root,
    "docs/prs/T1.md",
    "検証動画: recordings/t1.webm\n録画コマンド: node tools/verify-record/record.mjs\n終了コード: 0\n",
  );
  assert.throws(() => attachPr(state, root, "T1", "docs/prs/T1.md", "recordings/t1.webm"), /ありません/);
  fakeVideo(root, "recordings/t1.webm");
  state = attachPr(state, root, "T1", "docs/prs/T1.md", "recordings/t1.webm");
  assert.equal(state.phase, "deploy");
  assert.deepEqual(validate(state, root), []);
});

test("自分用アプリの PRD は該当なし（自分用）が要る", () => {
  const root = tempRoot();
  let state = answer(createState("demo"), "what", ANSWERS.what);
  state = answer(state, "who", "自分だけ。使う人も自分。");
  state = answer(state, "shape", "dynamic");
  state = answer(state, "features", JSON.stringify(FEATURES));
  state = answer(state, "data", "売り切れフラグをリクエストごとに読む");
  state = answer(state, "look", ANSWERS.look);
  state = answer(state, "domain", ANSWERS.domain);
  write(
    root,
    state.hearing.summaryPath,
    `# 要求まとめ\n自分だけ。使う人も自分。\n${ANSWERS.what}\ndynamic\n${FEATURES[0].name} ${FEATURES[0].release}\n${FEATURES[1].name} ${FEATURES[1].release}\n売り切れフラグをリクエストごとに読む\n${ANSWERS.look}\n${ANSWERS.domain}\n`,
  );
  state = acceptSummary(state, root, "user");
  write(root, state.prd.path, `# PRD\n\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`);
  assert.throws(() => approvePrd(state, root, "user"), /該当なし（自分用）/);
  write(
    root,
    state.prd.path,
    `# PRD\n\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n該当なし（自分用）\n`,
  );
  state = approvePrd(state, root, "user");
  assert.equal(state.phase, "mockup");
});

test("空の公開は実装中に記録でき、v1 は動画が揃うまで拒む", () => {
  const root = tempRoot();
  let state = hear(createState("demo"));
  write(root, state.hearing.summaryPath, summaryBody());
  state = acceptSummary(state, root, "bot");
  assert.throws(
    () => confirmDeploy(state, "v1", "run", "user", "動画の前に v1 を確定したい"),
    /検証動画/,
  );
  state = confirmDeploy(state, "empty", "run", "user", "空ページを本番に出す");
  assert.equal(state.phase, "implement");
  state = markDeploy(state, "empty", 0);
  assert.equal(state.phase, "implement");
  assert.equal(state.deploy.milestones.find((item) => item.id === "empty").executed, true);
  const app = readyToImplement(root, "approval");
  assert.throws(
    () => confirmDeploy(app, "empty", "run", "bot", "ボットが空のアプリを出す"),
    /利用者/,
  );
  const recorded = markDeploy(
    confirmDeploy(app, "empty", "run", "user", "空のアプリを本番に出す"),
    "empty",
    0,
  );
  assert.equal(recorded.phase, "implement");
});

test("空の公開はチケット確定前にはできない", () => {
  const root = tempRoot();
  const state = readyForTickets(root, "approval");
  assert.equal(state.phase, "tickets");
  assert.throws(
    () => confirmDeploy(state, "empty", "run", "user", "設計の直後に空のアプリを出したい"),
    /implement/,
  );
});

test("実装の next は依存が片付いた未着手の一番上を示す", () => {
  const root = tempRoot();
  let state = readyToImplement(root, "approval");
  write(
    root,
    "docs/tickets/T1.md",
    `T1\n${EMPTY_APP_TICKET_TITLE}\n- 依存: なし\n受入条件\n本番 URL に空のアプリが出る\n`,
  );
  write(
    root,
    "docs/tickets/T2.md",
    "T2\n営業時間を表示する\n- 依存: T3\n受入条件\n店名と時間が見える\n",
  );
  write(
    root,
    "docs/tickets/T3.md",
    "T3\n営業時間を表示する\n- 依存: T1\n受入条件\n補足が見える\n",
  );
  state = {
    ...state,
    tickets: {
      ...state.tickets,
      items: [
        { ...state.tickets.items[0], pr: { path: "docs/prs/T1.md", video: "recordings/t1.webm" } },
        state.tickets.items[1],
        {
          id: "T3",
          title: "営業時間を表示する",
          size: "S",
          feature: "営業時間を表示する",
          path: "docs/tickets/T3.md",
          pr: null,
        },
      ],
    },
  };
  const next = nextAction(state, root);
  assert.match(next.message, /チケット T3 だけ/);
  assert.match(next.message, /並列にしません/);
  write(root, "docs/tickets/T3.md", "T3\n営業時間を表示する\n- 依存: T2\n受入条件\n補足が見える\n");
  assert.match(nextAction(state, root).message, /利用者に相談/);
});

test("アプリの最初のチケットは空の本番公開", () => {
  const root = tempRoot();
  const state = readyForTickets(root, "approval");
  write(root, "docs/tickets/T1.md", "T1\n営業時間を表示する\n受入条件\n店名と時間が見える\n");
  assert.throws(
    () =>
      addTicket(state, root, {
        id: "T1",
        title: "営業時間を表示する",
        size: "S",
        feature: "営業時間を表示する",
        path: "docs/tickets/T1.md",
      }),
    /空のアプリ/,
  );
});

test("init は PRD と Design Doc のテンプレートを docs に置く", () => {
  const root = tempRoot();
  const cli = path.join(path.dirname(new URL(import.meta.url).pathname), "cli.mjs");
  const result = spawnSync(process.execPath, [cli, "init", "--root", root, "--name", "demo"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const prd = fs.readFileSync(path.join(root, "docs/prd.md"), "utf8");
  const design = fs.readFileSync(path.join(root, "docs/design-doc.md"), "utf8");
  assert.match(prd, /エレベーターピッチ/);
  assert.match(design, /Design Doc/);
  assert.match(design, /wrangler/);
  assert.equal(fs.existsSync(path.join(root, "docs/mockup")), false);
});

test("Wrangler は確認しても禁止で、cf deploy は確認が要る", () => {
  assert.equal(classifyCommand("npx wrangler deploy").class, "forbidden");
  assert.equal(classifyCommand("npx wrangler deploy", { track: "app" }).class, "forbidden");
  assert.equal(classifyCommand("npx wrangler deploy", { track: "site" }).class, "confirm");
  assert.equal(classifyCommand("npx wrangler dev", { track: "site" }).class, "allow");
  assert.equal(classifyCommand("cf deploy").class, "confirm");
  assert.equal(classifyCommand("npm run deploy").class, "confirm");
  assert.equal(classifyCommand("void deploy --platform cloudflare").class, "confirm");
  assert.equal(classifyCommand("cf d1 query db --sql 'DROP TABLE hours'").class, "confirm");
  assert.equal(classifyCommand("cf zones list").class, "allow");
  assert.equal(classifyCommand("cf d1 query db --sql 'SELECT 1'").class, "allow");
});

function readyForDesign(root, mode) {
  let state = hearDynamic(createState("demo"));
  write(root, state.hearing.summaryPath, dynamicSummary());
  state = acceptSummary(state, root, "user");
  write(root, state.prd.path, `# PRD\n\ndemo\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`);
  state = approvePrd(state, root, "user");
  write(root, state.mockup.path, "<!doctype html><html><body><p>demo</p></body></html>\n");
  state = approveMockup(state, root, "user");
  write(root, "docs/03-mode.md", `${mode} で進める。\n`);
  return setMode(state, root, mode, "user");
}

function designBody(reason) {
  return `# 設計書\n\nAstro\n${reason}\n営業時間を表示する\n`;
}

function readyForTickets(root, mode) {
  const state = readyForDesign(root, mode);
  const reason = "保存があるのでアプリケーションとして扱う";
  write(root, state.design.path, `# 設計書\n\nVoid\n${reason}\n営業時間を表示する\n`);
  const by = mode === "approval" ? "user" : "bot";
  return approveDesign(state, root, by, "void", reason);
}

function readyToImplement(root, mode) {
  let state = readyForTickets(root, mode);
  write(root, "docs/tickets/T1.md", `T1\n${EMPTY_APP_TICKET_TITLE}\n受入条件\n本番 URL に空のアプリが出る\n`);
  state = addTicket(state, root, {
    id: "T1",
    title: EMPTY_APP_TICKET_TITLE,
    size: "S",
    feature: "本番公開",
    path: "docs/tickets/T1.md",
  });
  write(root, "docs/tickets/T2.md", "T2\n営業時間を表示する\n受入条件\n店名と時間が見える\n");
  state = addTicket(state, root, {
    id: "T2",
    title: "営業時間を表示する",
    size: "S",
    feature: "営業時間を表示する",
    path: "docs/tickets/T2.md",
  });
  const by = mode === "approval" ? "user" : "bot";
  return confirmTickets(state, by);
}

function readyToDeploy(root, mode) {
  let state = readyToImplement(root, mode);
  write(
    root,
    "docs/prs/T1.md",
    "T1\n検証動画: recordings/t1.webm\n録画コマンド: node tools/verify-record/record.mjs\n終了コード: 0\n",
  );
  write(
    root,
    "docs/prs/T2.md",
    "T2\n検証動画: recordings/t2.webm\n録画コマンド: node tools/verify-record/record.mjs\n終了コード: 0\n",
  );
  fakeVideo(root, "recordings/t1.webm");
  fakeVideo(root, "recordings/t2.webm");
  state = attachPr(state, root, "T1", "docs/prs/T1.md", "recordings/t1.webm");
  return attachPr(state, root, "T2", "docs/prs/T2.md", "recordings/t2.webm");
}

function hearDynamic(state) {
  let current = answer(state, "what", ANSWERS.what);
  current = answer(current, "who", ANSWERS.who);
  current = answer(current, "shape", "dynamic");
  current = answer(current, "features", JSON.stringify(FEATURES));
  current = answer(current, "data", "売り切れフラグをリクエストごとに読む");
  current = answer(current, "look", ANSWERS.look);
  current = answer(current, "domain", ANSWERS.domain);
  return current;
}

function dynamicSummary() {
  return `# 要求まとめ
${ANSWERS.what}
${ANSWERS.who}
dynamic
${FEATURES[0].name} ${FEATURES[0].release}
${FEATURES[1].name} ${FEATURES[1].release}
売り切れフラグをリクエストごとに読む
${ANSWERS.look}
${ANSWERS.domain}
`;
}
