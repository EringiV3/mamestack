import fs from "node:fs";
import path from "node:path";

import {
  addTicket,
  answer,
  approveDesign,
  approveMockup,
  approvePrd,
  attachPr,
  classifyCommand,
  confirmDeploy,
  confirmTickets,
  createState,
  markDeploy,
  nextAction,
  setMode,
  validate,
  acceptSummary,
} from "./machine.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function statePath(root) {
  return path.join(path.resolve(root), ".mamestack", "state.json");
}

function load(root) {
  const file = statePath(root);
  if (!fs.existsSync(file)) {
    throw new Error(`状態ファイルがありません: ${file}\n先に init してください。`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(root, state) {
  const file = statePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

function requireRoot(args) {
  const root = typeof args.root === "string" ? args.root : "";
  if (root === "") {
    throw new Error("--root を指定してください");
  }
  return path.resolve(root);
}

function commit(root, state) {
  const errors = validate(state, root);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  save(root, state);
  const next = nextAction(state, root);
  console.log(`phase: ${state.phase}`);
  console.log(next.message);
}

function printHelp() {
  console.log(`mamestack gate

  init --root <dir> --name <name>
  status --root <dir>
  next --root <dir>
  check --root <dir>
  answer --root <dir> --key <key> --text <text>
  accept-summary --root <dir> --by user
  approve-prd --root <dir> --by user
  approve-mockup --root <dir> --by user
  set-mode --root <dir> --mode full-auto|approval --by user
  approve-design --root <dir> --by user|bot --framework astro|void --reason <text>
  add-ticket --root <dir> --id T1 --title <text> --size S|M --feature <name> --file <path>
  confirm-tickets --root <dir> --by user|bot
  attach-pr --root <dir> --ticket T1 --pr <path> --video <path>
  confirm-deploy --root <dir> --milestone v1 --decision run|skip --by user --reason <text>
  mark-deploy --root <dir> --milestone v1 --exit 0
  guard --command <shell>
`);
}

function placeProductTemplates(root) {
  const templatesDir = path.resolve(import.meta.dirname, "../../templates");
  const copies = [
    ["prd.md", "docs/prd.md"],
    ["design-doc.md", "docs/design-doc.md"],
  ];
  const placed = [];
  for (const [name, destRel] of copies) {
    const src = path.join(templatesDir, name);
    const dest = path.join(root, destRel);
    if (!fs.existsSync(src) || fs.existsSync(dest)) {
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    placed.push(destRel);
  }
  if (placed.length > 0) {
    console.log(`template: ${placed.join(", ")}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || command === "help" || args.help) {
    printHelp();
    return;
  }
  if (command === "guard") {
    const shell = typeof args.command === "string" ? args.command : "";
    if (shell === "") {
      throw new Error("--command を指定してください");
    }
    let track = null;
    if (typeof args.root === "string" && args.root !== "") {
      track = load(path.resolve(args.root)).track ?? null;
    }
    const result = classifyCommand(shell, { track });
    if (result.class === "allow") {
      console.log("allow");
      return;
    }
    if (result.class === "forbidden") {
      console.error(`forbidden: ${result.reason}`);
      process.exitCode = 4;
      return;
    }
    if (result.class === "confirm") {
      if (args["confirmed-by"] === "user") {
        console.log(`confirmed: ${result.reason}`);
        return;
      }
      console.error(`confirm: ${result.reason}`);
      process.exitCode = 3;
      return;
    }
    throw new Error(`未知の分類です: ${result.class}`);
  }

  const root = requireRoot(args);
  if (command === "init") {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (name.length < 2) {
      throw new Error("--name を指定してください");
    }
    if (fs.existsSync(statePath(root))) {
      throw new Error("既に init 済みです");
    }
    placeProductTemplates(root);
    const state = createState(name);
    commit(root, state);
    return;
  }

  const state = load(root);
  if (command === "status") {
    console.log(JSON.stringify({ phase: state.phase, mode: state.mode, name: state.name }, null, 2));
    return;
  }
  if (command === "next") {
    const next = nextAction(state, root);
    console.log(`phase: ${state.phase}`);
    console.log(next.message);
    return;
  }
  if (command === "check") {
    const errors = validate(state, root);
    if (errors.length > 0) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
      return;
    }
    console.log(`ok phase=${state.phase} mode=${state.mode ?? "unset"}`);
    return;
  }
  if (command === "answer") {
    commit(root, answer(state, String(args.key ?? ""), String(args.text ?? "")));
    return;
  }
  if (command === "accept-summary") {
    commit(root, acceptSummary(state, root, args.by));
    return;
  }
  if (command === "approve-prd") {
    commit(root, approvePrd(state, root, args.by));
    return;
  }
  if (command === "approve-mockup") {
    commit(root, approveMockup(state, root, args.by));
    return;
  }
  if (command === "set-mode") {
    commit(root, setMode(state, root, args.mode, args.by));
    return;
  }
  if (command === "approve-design") {
    commit(
      root,
      approveDesign(state, root, args.by, args.framework, String(args.reason ?? "")),
    );
    return;
  }
  if (command === "add-ticket") {
    commit(
      root,
      addTicket(state, root, {
        id: args.id,
        title: args.title,
        size: args.size,
        feature: args.feature,
        path: args.file,
      }),
    );
    return;
  }
  if (command === "confirm-tickets") {
    commit(root, confirmTickets(state, args.by));
    return;
  }
  if (command === "attach-pr") {
    commit(root, attachPr(state, root, args.ticket, args.pr, args.video));
    return;
  }
  if (command === "confirm-deploy") {
    commit(
      root,
      confirmDeploy(state, args.milestone, args.decision, args.by, String(args.reason ?? "")),
    );
    return;
  }
  if (command === "mark-deploy") {
    commit(root, markDeploy(state, args.milestone, Number(args.exit)));
    return;
  }
  throw new Error(`未知のコマンドです: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
