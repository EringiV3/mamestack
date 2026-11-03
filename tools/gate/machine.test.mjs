import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acceptSummary,
  addTicket,
  answer,
  approveDesign,
  approvePrd,
  attachPr,
  classifyCommand,
  confirmDeploy,
  confirmTickets,
  createState,
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

test("機能は3つまでで、v1 が一つは要る", () => {
  let state = answer(createState("demo"), "what", ANSWERS.what);
  state = answer(state, "who", ANSWERS.who);
  state = answer(state, "shape", "static");
  assert.throws(
    () => answer(state, "features", JSON.stringify([{ name: "だけ", release: "later" }])),
    /v1/,
  );
  const four = [
    { name: "a", release: "v1" },
    { name: "b", release: "later" },
    { name: "c", release: "later" },
    { name: "d", release: "later" },
  ];
  assert.throws(() => answer(state, "features", JSON.stringify(four)), /3つまで/);
});

test("PRD の前にモードは決まらず、承認は利用者だけ", () => {
  const root = tempRoot();
  let state = hear(createState("demo"));
  write(root, "docs/00-hearing.md", summaryBody());
  assert.throws(() => acceptSummary(state, root, "bot"), /利用者/);
  state = acceptSummary(state, root, "user");
  assert.equal(state.phase, "prd");
  assert.throws(() => setMode(state, root, "full-auto", "user"), /PRD/);
});

test("approval ではボットが設計書を確定できない", () => {
  const root = tempRoot();
  const ready = readyForDesign(root, "approval");
  const reason = "保存のない静的サイトなので Astro を使う";
  write(root, "docs/02-design.md", designBody(reason));
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
  const done = confirmDeploy(deploying, "v1", "skip", "user", "アカウントが無いので公開しない");
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
  const state = readyForTickets(root, "approval");
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
  write(root, state.modeNotePath, "approval を選ぶ。\n");
  state = setMode(state, root, "approval", "user");
  const reason = "保存があるのでアプリケーションとして扱う";
  write(root, state.design.path, `# 設計書\n\nAstro\n${reason}\n営業時間を表示する\n`);
  assert.throws(() => approveDesign(state, root, "user", "astro", reason), /Void/);
});

test("Wrangler は確認しても禁止で、cf deploy は確認が要る", () => {
  assert.equal(classifyCommand("npx wrangler deploy").class, "forbidden");
  assert.equal(classifyCommand("cf deploy").class, "confirm");
  assert.equal(classifyCommand("void deploy --platform cloudflare").class, "confirm");
  assert.equal(classifyCommand("cf d1 query db --sql 'DROP TABLE hours'").class, "confirm");
  assert.equal(classifyCommand("cf zones list").class, "allow");
  assert.equal(classifyCommand("cf d1 query db --sql 'SELECT 1'").class, "allow");
});

function readyForDesign(root, mode) {
  let state = hear(createState("demo"));
  write(root, "docs/00-hearing.md", summaryBody());
  state = acceptSummary(state, root, "user");
  write(root, "docs/01-prd.md", `# PRD\n\ndemo\n${ANSWERS.what}\n営業時間を表示する\n売り切れをスマホで更新する\n`);
  state = approvePrd(state, root, "user");
  write(root, "docs/03-mode.md", `${mode} で進める。\n`);
  return setMode(state, root, mode, "user");
}

function designBody(reason) {
  return `# 設計書\n\nAstro\n${reason}\n営業時間を表示する\n`;
}

function readyForTickets(root, mode) {
  const state = readyForDesign(root, mode);
  const reason = "保存のない静的サイトなので Astro を使う";
  write(root, "docs/02-design.md", designBody(reason));
  const by = mode === "approval" ? "user" : "bot";
  return approveDesign(state, root, by, "astro", reason);
}

function readyToImplement(root, mode) {
  let state = readyForTickets(root, mode);
  write(root, "docs/tickets/T1.md", "T1\n営業時間を表示する\n受入条件\n店名と時間が見える\n");
  state = addTicket(state, root, {
    id: "T1",
    title: "営業時間を表示する",
    size: "S",
    feature: "営業時間を表示する",
    path: "docs/tickets/T1.md",
  });
  const by = mode === "approval" ? "user" : "bot";
  return confirmTickets(state, by);
}

function readyToDeploy(root, mode) {
  const state = readyToImplement(root, mode);
  write(
    root,
    "docs/prs/T1.md",
    "T1\n検証動画: recordings/t1.webm\n録画コマンド: node tools/verify-record/record.mjs\n終了コード: 0\n",
  );
  fakeVideo(root, "recordings/t1.webm");
  return attachPr(state, root, "T1", "docs/prs/T1.md", "recordings/t1.webm");
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
