import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const archivePath = resolve(
  workspaceRoot,
  process.argv[2] ?? "dist-production.zip",
);
const maxCapturedOutput = 1_000_000;

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const capture = (current, chunk) =>
      `${current}${chunk}`.slice(-maxCapturedOutput);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = capture(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = capture(stderr, chunk);
    });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(
          new Error(
            `${command} ${args.join(" ")} failed (${signal ?? code}).\n${stdout}${stderr}`,
          ),
        );
      }
    });
  });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a local API test port.");
  }
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  return address.port;
}

function safeApiEnvironment(port) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (
      /^(AGENCY_|REAL_API_|CLERK_SECRET_KEY$|AUDIT_ID_HMAC_KEY$)/.test(key)
    ) {
      delete environment[key];
    }
  }
  return {
    ...environment,
    NODE_ENV: "production",
    PORT: String(port),
    USE_REAL_API: "false",
    AGENCY_PACKET_SYNC_ENABLED: "false",
    CLERK_TELEMETRY_DISABLED: "true",
    AUDIT_ID_HMAC_KEY: "archive-smoke-test-only-key-never-use-for-real-data",
    // Deliberately non-operational Clerk test values; health does not call Clerk.
    CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZS5jb20k",
    CLERK_SECRET_KEY: "sk_test_archive_smoke_placeholder_not_valid",
  };
}

async function waitForHealth(child, port) {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The extracted API exited with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/healthz`, {
        signal: AbortSignal.timeout(1_000),
      });
      const body = await response.json();
      if (
        response.status !== 200 ||
        body.status !== "success" ||
        body.data?.[0]?.status !== "ok"
      ) {
        throw new Error(
          `Health endpoint returned ${response.status}: ${JSON.stringify(body)}`,
        );
      }
      return body;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }
  }

  throw new Error(
    `The extracted API did not become healthy within 15 seconds.${lastError ? ` Last error: ${lastError.message}` : ""}`,
  );
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise((resolveClose) => child.once("close", resolveClose));
  child.kill("SIGTERM");
  await Promise.race([
    closed,
    new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "api-package-smoke-"));
  const relativeTemporaryRoot = relative(workspaceRoot, temporaryRoot);
  if (
    !isAbsolute(temporaryRoot) ||
    relativeTemporaryRoot === "" ||
    (!relativeTemporaryRoot.startsWith("..") &&
      !isAbsolute(relativeTemporaryRoot))
  ) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw new Error("The smoke-test directory must be outside the repository.");
  }

  let apiProcess;
  try {
    const extractedRoot = join(temporaryRoot, "extracted");
    await mkdir(extractedRoot, { recursive: true });
    await run("unzip", ["-q", archivePath, "-d", extractedRoot]);
    await run(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund"],
      { cwd: extractedRoot },
    );

    const port = await reservePort();
    apiProcess = spawn("node", ["index.js"], {
      cwd: extractedRoot,
      env: safeApiEnvironment(port),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let startupOutput = "";
    for (const stream of [apiProcess.stdout, apiProcess.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        startupOutput = `${startupOutput}${chunk}`.slice(-maxCapturedOutput);
      });
    }

    try {
      const health = await waitForHealth(apiProcess, port);
      console.log(
        `Standalone API archive smoke test passed: ${JSON.stringify(health)}`,
      );
      console.log("The API ran from the extracted directory with production dependencies only.");
    } catch (error) {
      throw new Error(
        `${error.message}${startupOutput ? `\nAPI startup output:\n${startupOutput}` : ""}`,
      );
    } finally {
      await stop(apiProcess);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    "Standalone API archive smoke test failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
