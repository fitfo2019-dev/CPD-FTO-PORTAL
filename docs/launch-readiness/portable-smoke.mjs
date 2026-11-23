/**
 * Run after bundle:production, from root:
 * node docs/launch-readiness/portable-smoke.mjs
 *
 * Extracts API to an isolated ignored directory. No package install, DB, live
 * credentials or outbound service calls. A second boot deliberately borrows
 * existing dependencies and is NOT a clean-host installation claim.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:net";

const out = resolve("generated-artifacts/launch-readiness/portable");
await mkdir(out, { recursive: true });
spawnSync("unzip", ["-oq", resolve("dist-production.zip"), "-d", out], { stdio: "ignore" });
const manifest = JSON.parse(await readFile(resolve(out, "package.json"), "utf8"));
const results = {
  frozenInstall: "BLOCKED: archive has no release-specific lockfile; no dependency resolution/install attempted",
  dependencies: manifest.dependencies,
  cleanBoot: "",
  borrowedDependencyBoot: "",
  checks: [],
};
const env = { PATH: process.env.PATH, NODE_ENV: "production", USE_REAL_API: "false",
  AUDIT_ID_HMAC_KEY: "synthetic-readiness-key-never-use-for-real-records",
  // Public syntactically valid fixture, not a real provider or credential.
  CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from("synthetic.clerk.accounts.dev$").toString("base64"),
  CLERK_SECRET_KEY: "sk_test_synthetic_not_a_credential",
};
await rm(resolve(out, "node_modules"), { recursive: true, force: true });
const clean = spawnSync(process.execPath, ["index.js"], { cwd: out, env, encoding: "utf8", timeout: 5000 });
results.cleanBoot = `exit=${clean.status}; ${clean.stderr.includes("ERR_MODULE_NOT_FOUND") || clean.stdout.includes("startup_failure") ? "failed without installed dependencies (expected incomplete clean-host setup)" : "inspect clean-boot.log"}`;
await writeFile(resolve(out, "clean-boot.log"), clean.stdout + clean.stderr);
await symlink(resolve("artifacts/api-server/node_modules"), resolve(out, "node_modules"), "dir");
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const child = spawn(process.execPath, ["index.js"], { cwd: out, env: { ...env, PORT: String(port) } });
let output = "";
child.stdout.on("data", data => { output += data; });
child.stderr.on("data", data => { output += data; });
let exited = false;
child.on("exit", () => { exited = true; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 40 && !exited; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (output.includes("Server listening")) { ready = true; break; }
  }
  if (!ready) throw new Error("Borrowed-dependency process did not start");
  results.borrowedDependencyBoot = "PASS with workspace dependencies, synthetic config, no DB; NOT clean-host install";
  for (const [path, expected] of [
    ["/api/healthz", 200], ["/api/v1/training-packets", 401],
    ["/api/v1/resources", 401], ["/api/v1/phase-extension-requests", 401],
    ["/api/v1/staging/training-records", 404], ["/api/auth/mock-login", 404],
    ["/", 404],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });
    results.checks.push({ path, expected, actual: response.status,
      pass: response.status === expected, cacheControl: response.headers.get("cache-control"),
      cspPresent: Boolean(response.headers.get("content-security-policy")) });
  }
  // A controlled stop/restart is documented for agency rehearsal; this local
  // process is stopped below without touching configured application workflows.
} catch (error) {
  results.borrowedDependencyBoot = `FAILED: ${error.message}`;
  process.exitCode = 1;
} finally {
  if (!exited) {
    const done = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGTERM"); await done;
  }
  await writeFile(resolve(out, "borrowed-boot.log"), output);
  await writeFile(resolve(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}
if (results.checks.some(item => !item.pass)) process.exitCode = 1;
