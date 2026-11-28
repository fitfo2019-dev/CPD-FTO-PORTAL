import assert from "node:assert/strict";
import test from "node:test";
import { summarizePacketPoTotals } from "../src/lib/packet-po-totals.js";

const empty = {
  id: "daily-1",
  date: "2026-11-24",
  activity: { fiReports: 2, trafficStops: 1 },
  ratingsReviewedAt: "2026-11-24T20:00:00Z",
  ratings: {
    one: { rating: "A", justification: "private narrative" },
    two: { rating: "UA", justification: "Reviewed own unacceptable." },
    three: "not-a-rating",
  },
  runs: [
    { id: "run-1", formStatus: "complete", checklistReviewedAt: "2026-11-24T19:00:00Z" },
    { id: "run-2", formStatus: "in_progress" },
  ],
  narrative: "private report narrative",
};

test("PO packet totals expose daily, Sunday-week, month counts, and own UA details only", () => {
  const rows = [
    { report: { ...empty, id: "daily-1" }, record_date: "2026-11-24" },
    { report: { ...empty, id: "daily-2", ratingsReviewedAt: undefined, activity: { fiReports: 1 } },
      record_date: "2026-11-23" },
    { report: { ...empty, id: "prior-month" }, record_date: "2026-10-31" },
  ];
  const totals = summarizePacketPoTotals(rows, "2026-11-24");

  assert.deepEqual(totals.daily.activity.fiReports, 2);
  assert.deepEqual(totals.daily.rating_counts, { NO: 0, A: 1, RT: 0, UA: 1, NRT: 0 });
  assert.equal(totals.daily.reviewed_run_checklists, 1);
  assert.equal(totals.daily.total_runs, 2);
  assert.equal(totals.weekly.log_count, 2);
  assert.equal(totals.weekly.activity.fiReports, 3);
  assert.equal(totals.weekly.reviewed_log_count, 1);
  assert.equal(totals.monthly.log_count, 2);
  assert.equal(totals.monthly.start_date, "2026-11-01");
  assert.equal(totals.monthly.end_date, "2026-11-30");
  assert.deepEqual(totals.unacceptable_details, [{
    record_date: "2026-11-24", category_key: "two", rating: "UA",
    justification: "Reviewed own unacceptable.", limbo_day: false,
  }]);
  assert.equal(JSON.stringify(totals).includes("private report narrative"), false);
  assert.equal(JSON.stringify(totals).includes("private narrative"), false);
});

test("PO unacceptable details list Limbo Day UA's as not counted", () => {
  const totals = summarizePacketPoTotals([
    { record_date: "2026-11-23", report: {
      date: "2026-11-23", limboDay: true, ratings: {},
      runs: [{ id: "r1", uaBox: { whatHappened: "Synthetic limbo detail.", correctiveTraining: "Synthetic training." } }],
      checklistDeficiencies: [{ id: "g1", runId: "r1", category: "buildingSearch", tasks: [], narrative: "" }],
    } },
  ], "2026-11-24");
  assert.deepEqual(totals.unacceptable_details, [{
    record_date: "2026-11-23", category_key: "buildingSearch", rating: "UA",
    justification: "Synthetic limbo detail. Synthetic training.", limbo_day: true,
  }]);
  assert.equal(totals.daily.rating_counts.UA + totals.weekly.rating_counts.UA, 0);
});

test("PO unacceptable details exclude unreviewed, Limbo ratings, and non-UA ratings", () => {
  const totals = summarizePacketPoTotals([
    { record_date: "2026-11-22", report: {
      date: "2026-11-22", ratingsReviewedAt: undefined, ratings: {
        unreviewed: { rating: "UA", justification: "Not reviewed." },
      },
    } },
    { record_date: "2026-11-23", report: {
      date: "2026-11-23", ratingsReviewedAt: "now", limboDay: true, ratings: {
        limbo: { rating: "UA", justification: "Limbo record." },
      },
    } },
    { record_date: "2026-11-24", report: {
      date: "2026-11-24", ratingsReviewedAt: "now", ratings: {
        acceptable: { rating: "A", justification: "Not an unacceptable." },
      },
    } },
  ], "2026-11-24");
  assert.deepEqual(totals.unacceptable_details, []);
});

test("run-derived activity counts use only completed and reviewed checklists", () => {
  const totals = summarizePacketPoTotals([{
    record_date: "2026-11-22",
    report: {
      id: "derived",
      date: "2026-11-22",
      activity: {},
      runs: [
        { id: "one-v", runKind: "traffic_stop", clearanceCode: "1V", clearanceRulesVersion: 1,
          formStatus: "complete", checklistReviewedAt: "now", activityFlags: { trafficCitations: true } },
        { id: "pending", runKind: "traffic_stop", clearanceCode: "1V", clearanceRulesVersion: 1,
          formStatus: "complete", activityFlags: { trafficCitations: true } },
      ],
    },
  }], "2026-11-22");
  assert.equal(totals.daily.activity.trafficCitations, 1);
  assert.equal(totals.daily.activity.trafficStops, 1);
  assert.equal(totals.daily.reviewed_run_checklists, 1);
  assert.equal(totals.daily.total_runs, 2);
});

test("server totals count Not Applicable as Not Observed and keep one UA per category per run and Officer Safety once per day", () => {
  const report = {
    id: "daily-na", date: "2026-11-24", ratingsReviewedAt: "2026-11-24T20:00:00Z",
    notApplicableCategories: ["resourceEquipmentUsage"],
    ratings: {
      resourceEquipmentUsage: { rating: "" },
      contentAccuracy: { rating: "UA" },
      buildingSearch: { rating: "UA" },
    },
    runs: [{ id: "r1", occurredAt: "2026-11-24T13:00:00Z" }, { id: "r2", occurredAt: "2026-11-24T15:00:00Z" }],
    checklistDeficiencies: [
      { category: "contentAccuracy", runId: "r1" }, { category: "contentAccuracy", runId: "r1", added: true },
      { category: "contentAccuracy", runId: "r2" },
      { category: "buildingSearch", runId: "r1" }, { category: "buildingSearch", runId: "r2" },
    ],
  };
  const totals = summarizePacketPoTotals([{ report, record_date: "2026-11-24" }], "2026-11-24");
  assert.deepEqual(totals.daily.rating_counts, { NO: 1, A: 0, RT: 0, UA: 3, NRT: 0 });
});
