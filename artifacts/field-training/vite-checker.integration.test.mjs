import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = path.dirname(fileURLToPath(import.meta.url));

function runPortalBuild() {
  return spawnSync("pnpm", ["run", "build"], {
    cwd: portalRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
  });
}

async function reservePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForResponse(url, child, getOutput, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `The Vite dev server exited before becoming ready.\n${getOutput()}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`Vite returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError}\n${getOutput()}`,
  );
}

function waitForCheckerUpdate(
  socket,
  predicate,
  getOutput = () => "",
  timeoutMs = 30_000,
) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for a checker overlay update.\n${getOutput()}`,
        ),
      );
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onError);
    };

    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (predicate(message)) {
        cleanup();
        resolve(message.data.data);
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error("The Vite HMR WebSocket reported an error."));
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
  });
}

function isCheckerOverlayUpdate(message) {
  return (
    message.type === "custom" &&
    message.event === "vite-plugin-checker" &&
    message.data?.event === "vite-plugin-checker:error"
  );
}

test(
  "the portal Vite build rejects TypeScript errors and passes when clean",
  { timeout: 7 * 60_000 },
  async () => {
    const cleanBuild = runPortalBuild();
    assert.ifError(cleanBuild.error);
    assert.equal(
      cleanBuild.status,
      0,
      `The clean portal Vite build should pass.\n${cleanBuild.stdout}\n${cleanBuild.stderr}`,
    );

    const probeName = `vite-checker-probe-${process.pid}.ts`;
    const probePath = path.join(portalRoot, "src", probeName);

    try {
      await writeFile(
        probePath,
        "const checkerProbe: string = 42;\nexport default checkerProbe;\n",
        { flag: "wx" },
      );

      const failingBuild = runPortalBuild();
      assert.ifError(failingBuild.error);
      const output = `${failingBuild.stdout}\n${failingBuild.stderr}`;
      assert.notEqual(
        failingBuild.status,
        0,
        `The Vite build must fail when a TypeScript error is present.\n${output}`,
      );
      assert.match(
        output,
        new RegExp(`src[/\\\\]${probeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
        "The checker output should identify the injected TypeScript file.",
      );
      assert.match(output, /TS2322/, "The checker should report the type mismatch.");
    } finally {
      await rm(probePath, { force: true });
    }
  },
);

test(
  "the Vite dev server sends TypeScript diagnostics to the live checker overlay and recovers",
  { timeout: 2 * 60_000 },
  async () => {
    const port = await reservePort();
    const probeName = `vite-checker-dev-probe-${process.pid}.ts`;
    const probePath = path.join(portalRoot, "src", probeName);
    const output = [];
    let child;
    let socket;

    try {
      await writeFile(
        probePath,
        "const checkerDevProbe: string = 42;\nexport default checkerDevProbe;\n",
        { flag: "wx" },
      );

      child = spawn("pnpm", ["run", "dev"], {
        cwd: portalRoot,
        env: {
          ...process.env,
          BASE_PATH: "/",
          FORCE_COLOR: "0",
          NO_COLOR: "1",
          PORT: String(port),
        },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.setEncoding("utf8").on("data", (chunk) => output.push(chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk) => output.push(chunk));
      const getOutput = () => output.join("");
      const pageUrl = `http://127.0.0.1:${port}/`;
      const page = await waitForResponse(pageUrl, child, getOutput);
      const html = await page.text();

      assert.match(
        html,
        /@vite-plugin-checker-runtime/,
        "The development page should load the checker overlay runtime.",
      );

      const runtimeResponse = await fetch(
        `http://127.0.0.1:${port}/@vite-plugin-checker-runtime`,
      );
      assert.equal(runtimeResponse.status, 200);
      assert.match(
        await runtimeResponse.text(),
        /vite-plugin-checker-error-overlay/,
        "The served checker runtime should register its preview overlay.",
      );

      socket = new WebSocket(`ws://127.0.0.1:${port}/`, "vite-hmr");
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener(
          "error",
          () => reject(new Error(`Could not connect to Vite HMR.\n${getOutput()}`)),
          { once: true },
        );
      });

      const errorUpdate = waitForCheckerUpdate(
        socket,
        (message) =>
          isCheckerOverlayUpdate(message) &&
          message.data.data.diagnostics.some(
            (diagnostic) =>
              diagnostic.id?.includes(probeName) &&
              diagnostic.message.includes("not assignable to type 'string'"),
          ),
        getOutput,
      );
      socket.send(
        JSON.stringify({
          type: "custom",
          event: "vite-plugin-checker",
          data: { event: "runtime-loaded" },
        }),
      );

      const errorPayload = await errorUpdate;
      assert.ok(
        errorPayload.diagnostics.some(
          (diagnostic) =>
            diagnostic.id?.includes(probeName) &&
            diagnostic.message.includes("not assignable to type 'string'"),
        ),
        `The overlay should receive the injected TypeScript error.\n${getOutput()}`,
      );

      await rm(probePath, { force: true });
      const cleanUpdate = await waitForCheckerUpdate(
        socket,
        (message) =>
          isCheckerOverlayUpdate(message) &&
          message.data.data.diagnostics.length === 0,
        getOutput,
      );
      assert.deepEqual(
        cleanUpdate.diagnostics,
        [],
        "The checker overlay should clear after removing the temporary error.",
      );

      const cleanPage = await fetch(pageUrl);
      assert.equal(
        cleanPage.status,
        200,
        `The Vite page should remain usable after the checker recovers.\n${getOutput()}`,
      );
      assert.equal(
        await fetch(`http://127.0.0.1:${port}/src/main.tsx`).then(
          (response) => response.status,
        ),
        200,
        `The portal entry module should still transform after recovery.\n${getOutput()}`,
      );
    } finally {
      await rm(probePath, { force: true });
      socket?.close();
      if (child && child.exitCode === null) {
        try {
          if (process.platform !== "win32" && child.pid) {
            process.kill(-child.pid, "SIGTERM");
          } else {
            child.kill("SIGTERM");
          }
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }
  },
);
