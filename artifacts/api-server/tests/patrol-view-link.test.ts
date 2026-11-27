import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { configuredPatrolViewUrl } from "../src/routes/patrol-view-link.ts";

test("Patrol View link reads only a valid http or https setting", () => {
  assert.equal(configuredPatrolViewUrl(undefined), null);
  assert.equal(configuredPatrolViewUrl("   "), null);
  assert.equal(configuredPatrolViewUrl("not a url"), null);
  assert.equal(configuredPatrolViewUrl("javascript:alert(1)"), null);
  assert.equal(configuredPatrolViewUrl("file:///etc/passwd"), null);
  assert.equal(configuredPatrolViewUrl("https://user:secret@example.invalid/pv"), null);
  assert.equal(configuredPatrolViewUrl(" http://example.invalid/PV "), "http://example.invalid/PV");
  assert.equal(configuredPatrolViewUrl("https://example.invalid/PV"), "https://example.invalid/PV");
});

test("Patrol View routes require sign-in and are never cached", async () => {
  const source = await readFile(new URL("../src/routes/patrol-view-link.ts", import.meta.url), "utf8");
  for (const path of ["/v1/patrol-view/status", "/v1/patrol-view/open"]) {
    assert.match(source, new RegExp(`router\\.get\\("${path.replaceAll("/", "\\/")}", requireClerkAuthentication`));
  }
  assert.match(source, /private, no-store/);
  assert.doesNotMatch(source, /res\.json\(\{[^}]*url/);
});
