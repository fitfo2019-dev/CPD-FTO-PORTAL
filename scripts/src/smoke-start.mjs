// Loads the built Field Training portal in a headless browser and fails when
// it does not start: a page error, an empty screen, or a start-up request for
// a piece that must download only after sign-in.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.env.SMOKE_START_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../artifacts/field-training/dist/public"));
const DEFERRED_ONLY = ["vendor-spreadsheet"];
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE_PATH, "playwright-core", "playwright"].filter(Boolean);
  const require = createRequire(import.meta.url);
  for (const name of candidates) {
    try { return await import(name.startsWith("/") ? name : require.resolve(name)); } catch { /* try next */ }
  }
  throw new Error("Start check needs playwright-core. Set PLAYWRIGHT_CORE_PATH to its index.mjs.");
}

const index = await readFile(join(root, "index.html"));
const base = (index.toString().match(/src="(\/[^"]*?)assets\//) ?? [, "/"])[1];
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const rel = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, "");
  const file = normalize(join(root, rel));
  try {
    if (!file.startsWith(root) || !extname(file)) throw new Error("app route");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    if (url.startsWith(`${base}api/`)) { res.writeHead(503); res.end(); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(index);
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const failures = [];
try {
  const page = await browser.newPage();
  const scripts = [];
  page.on("pageerror", (error) => failures.push(`Page error: ${error.message}`));
  page.on("request", (request) => { if (request.resourceType() === "script") scripts.push(request.url()); });
  await page.goto(`${origin}${base}`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(3_000);
  const rendered = await page.evaluate(() => document.getElementById("root")?.childElementCount ?? 0);
  if (rendered === 0) failures.push("The portal rendered nothing at start-up.");
  for (const name of DEFERRED_ONLY) {
    if (scripts.some((url) => url.includes(name))) failures.push(`${name} downloaded at start-up.`);
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Start check passed: the built portal started with no page errors.");
