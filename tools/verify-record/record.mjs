import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";

/**
 * @param {never} value
 */
function assertNever(value) {
  throw new Error(`未対応の操作です: ${JSON.stringify(value)}`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`位置引数は使えません: ${token}`);
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`--${key} に値がありません`);
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function contentType(file) {
  switch (path.extname(file)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".webm":
      return "video/webm";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function startStatic(dir, port) {
  const root = path.resolve(dir);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }
    const file = path.normalize(path.join(root, pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.writeHead(200, { "content-type": contentType(file) });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  if (!server) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function runStep(page, step, baseUrl) {
  const type = step.type;
  switch (type) {
    case "goto": {
      const target = typeof step.path === "string" ? new URL(step.path, baseUrl).toString() : step.url;
      if (typeof target !== "string") {
        throw new Error("goto には path か url が要ります");
      }
      await page.goto(target, { waitUntil: "domcontentloaded" });
      return;
    }
    case "click":
      await page.locator(step.selector).click();
      return;
    case "fill":
      await page.locator(step.selector).fill(step.value);
      return;
    case "press":
      await page.locator(step.selector).press(step.key);
      return;
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "assertText": {
      const locator = page.locator(step.selector);
      await locator.waitFor({ state: "visible", timeout: 5000 });
      const text = await locator.innerText();
      if (!text.includes(step.text)) {
        throw new Error(`「${step.selector}」に「${step.text}」がありません。実際: ${text}`);
      }
      return;
    }
    case "assertVisible":
      await page.locator(step.selector).waitFor({ state: "visible", timeout: 5000 });
      return;
    case "assertHidden":
      await page.locator(step.selector).waitFor({ state: "hidden", timeout: 5000 });
      return;
    case "assertStatus": {
      const target = typeof step.path === "string" ? new URL(step.path, baseUrl).toString() : step.url;
      if (typeof target !== "string") {
        throw new Error("assertStatus には path か url が要ります");
      }
      if (typeof step.status !== "number") {
        throw new Error("assertStatus には status が要ります");
      }
      const response = await page.request.get(target);
      if (response.status() !== step.status) {
        throw new Error(`${target} は ${response.status()}。期待は ${step.status}`);
      }
      return;
    }
    default:
      assertNever(type);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scenario || !args.out) {
    throw new Error("使い方: record.mjs (--serve <dir> | --base-url <url>) --scenario <file> --out <file.webm> [--port 41773]");
  }
  const scenario = JSON.parse(fs.readFileSync(path.resolve(args.scenario), "utf8"));
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    throw new Error("scenario.steps が空です");
  }
  const port = Number(args.port ?? 41773);
  let server = null;
  let browser = null;
  try {
    server = args.serve ? await startStatic(args.serve, port) : null;
    const baseUrl = args.serve ? `http://127.0.0.1:${port}/` : args["base-url"];
    if (!baseUrl) {
      throw new Error("--serve か --base-url のどちらかが要ります");
    }
    const out = path.resolve(args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "mamestack-video-"));
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    const video = page.video();
    for (const step of scenario.steps) {
      await runStep(page, step, baseUrl);
    }
    await page.waitForTimeout(400);
    await context.close();
    if (!video) {
      throw new Error("Playwright が動画を開始しませんでした");
    }
    await video.saveAs(out);
    const size = fs.statSync(out).size;
    if (size < 1024) {
      throw new Error(`動画が小さすぎます: ${out}`);
    }
    console.log(`verified-video: ${out} bytes=${size}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    await closeServer(server);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
