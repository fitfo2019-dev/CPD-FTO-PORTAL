import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createPortalWorker, retirePortalWorker } from "../../pwa-worker.js";

function worker(source: string, scope = "https://portal.test/") {
  const handlers = new Map<string, (event: unknown) => void>();
  const deleted: string[] = [];
  let claimed = false;
  let unregistered = false;
  const context = {
    URL, Set, Promise,
    self: {
      registration: { scope, unregister: async () => { unregistered = true; } },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: async () => {},
      addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
    },
    caches: {
      keys: async () => ["fieldready-shell-old", "other-app-cache"],
      delete: async (key: string) => { deleted.push(key); },
      match: async () => ({ cached: true }),
    },
    fetch: async () => ({ network: true }),
  };
  vm.runInNewContext(source, context);
  return { handlers, deleted, get claimed() { return claimed; }, get unregistered() { return unregistered; } };
}

test("a root-scoped portal worker never substitutes sign-in for approval previews or other artifacts", () => {
  const instance = worker(createPortalWorker("/", ["/", "/assets/app.js"], "test"));
  const intercepted = (path: string, mode = "navigate") => {
    let handled = false;
    instance.handlers.get("fetch")?.({
      request: { url: `https://portal.test${path}`, method: "GET", mode },
      respondWith: () => { handled = true; },
    });
    return handled;
  };
  for (const path of ["/__mockup", "/__mockup/preview/PacketHandoffFlowPreview", "/approval-preview",
    "/ui-preview", "/ui-preview/reports", "/api/v1/training-packets", "/another-app/", "/pitch-deck/"]) {
    assert.equal(intercepted(path), false, path);
  }
  for (const path of ["/", "/sign-in", "/sign-in/sso-callback", "/reports/packet-1", "/resources"]) {
    assert.equal(intercepted(path), true, path);
  }
  assert.equal(intercepted("/assets/app.js", "cors"), true);
  assert.equal(intercepted("/__mockup/assets/preview.js", "cors"), false);
});

test("the portal navigation boundary also respects a non-root base path", () => {
  const instance = worker(createPortalWorker("/training-portal/", ["/training-portal/"], "test"),
    "https://portal.test/training-portal/");
  for (const [path, expected] of [
    ["/training-portal/reports/one", true],
    ["/training-portal/", true],
    ["/training-portal/approval-preview", false],
    ["/__mockup/preview/PacketHandoffFlowPreview", false],
    ["/reports/one", false],
  ] as const) {
    let handled = false;
    instance.handlers.get("fetch")?.({
      request: { url: `https://portal.test${path}`, method: "GET", mode: "navigate" },
      respondWith: () => { handled = true; },
    });
    assert.equal(handled, expected, path);
  }
});

test("development retires an old shell without deleting other caches or touching local records", async () => {
  const instance = worker(retirePortalWorker);
  let operation: Promise<unknown> | undefined;
  instance.handlers.get("activate")?.({ waitUntil: (promise: Promise<unknown>) => { operation = promise; } });
  await operation;
  assert.deepEqual(instance.deleted, ["fieldready-shell-old"]);
  assert.equal(instance.claimed, true);
  assert.equal(instance.unregistered, true);
  assert.equal(instance.handlers.has("fetch"), false);
  assert.doesNotMatch(retirePortalWorker, /indexedDB|localStorage|sessionStorage|clients\.navigate/);
});
