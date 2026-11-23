import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDispatchPrefill, applyDispatchPrefillValue, mapDispatchPrefillResponse } from "./dispatch-prefill.js";

test("maps a successful dispatch response while allowing absent fields", () => {
  assert.deepEqual(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 1 },
    data: [{
      eventIngressAt: "2026-11-23T19:05:00.000Z",
      incidentNumber: "INC-2468",
      dispatchedCode: "17a",
    }],
  }), {
    eventIngressAt: "2026-11-23T19:05:00.000Z",
    incidentNumber: "INC-2468",
    dispatchedCode: "17A",
  });
  assert.deepEqual(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 0 },
    data: [],
  }), {});
  assert.equal(mapDispatchPrefillResponse({ status: "error" }), undefined);
  assert.equal(mapDispatchPrefillResponse({
    status: "success",
    metadata: { total_records: 1 },
    data: [],
  }), undefined);
});

test("dispatch defaults fill untouched fields but preserve FTO corrections", () => {
  const initial = {
    runDateTimeText: "11/23/2026",
    runTimeText: "",
    incidentNumber: "",
    runLocation: "",
    dispatchedCode: "",
  };
  assert.deepEqual(applyDispatchPrefill(
    { ...initial, incidentNumber: "FTO-entered-number", runLocation: "FTO-entered location" },
    initial,
    {
      incidentNumber: "INC-2468",
      location: "100 Main Street",
      dispatchedCode: "17A",
    },
  ), {
    ...initial,
    incidentNumber: "FTO-entered-number",
    runLocation: "FTO-entered location",
    dispatchedCode: "17A",
  });
});

test("dispatch ingress time is a default only until the FTO changes it", () => {
  assert.equal(applyDispatchPrefillValue("11/23/2026", "11/23/2026", "11/22/2026 14:05"), "11/22/2026 14:05");
  assert.equal(applyDispatchPrefillValue("11/23/2026 13:55", "11/23/2026", "11/22/2026 14:05"), "11/23/2026 13:55");
});
