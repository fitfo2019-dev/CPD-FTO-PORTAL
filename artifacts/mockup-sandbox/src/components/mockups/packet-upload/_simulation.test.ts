import assert from "node:assert/strict";
import test from "node:test";
import { beginUpload, examplePackets, finishUpload, pendingPackets, uploadBlockReason } from "./_simulation.js";

test("only pending snapshots enter upload; confirmed copies become sealed", () => {
  const original = examplePackets();
  const active = beginUpload(original);
  assert.deepEqual(active.map(packet => packet.state), ["uploading", "uploading", "synchronized"]);
  assert.strictEqual(active[2], original[2]);
  const confirmed = finishUpload(active, false);
  assert.equal(pendingPackets(confirmed).length, 0);
  assert.ok(confirmed.every(packet => packet.state === "synchronized" && packet.version === 1));
  assert.equal(original[0].state, "pending");
});
test("unconfirmed outcomes retain snapshot identifiers through an exact retry", () => {
  const original = examplePackets();
  const failed = finishUpload(beginUpload(original), true);
  assert.equal(pendingPackets(failed).length, 2);
  assert.equal(failed[0].state, "failed");
  const retried = finishUpload(beginUpload(failed), false);
  assert.deepEqual(retried.map(packet => packet.id), original.map(packet => packet.id));
  assert.deepEqual(retried.map(packet => packet.date), original.map(packet => packet.date));
});
test("upload gates require an available, unlocked, saved and idle workspace", () => {
  const allowed = { online: true, unlocked: true, unsaved: false, ready: true, busy: false, count: 2 };
  assert.equal(uploadBlockReason(allowed), null);
  for (const override of [
    { online: false }, { unlocked: false }, { unsaved: true }, { ready: false },
    { busy: true }, { count: 0 }, { count: 101 },
  ]) assert.ok(uploadBlockReason({ ...allowed, ...override }));
});
