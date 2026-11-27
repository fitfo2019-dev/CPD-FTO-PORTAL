const ACTIVITY_KEYS = [
  "premierOneReports", "fiReports", "accidentReports", "impoundSlips", "pcAffidavits",
  "propertySlips", "trafficStops", "trafficCitations", "solveCitationSummons",
  "parkingCitations", "firstResponderLetters", "u10100Reports", "arrestProcessForms",
  "criminalComplaints", "misdemeanorSummons", "misdemeanorArrests", "felonyPackets",
  "felonyArrests", "dvPackets", "oviPackets", "prisonersSlated", "completedPayouts",
  "summonsReissued", "suspiciousPersonStops", "prisonerSearches", "patDowns",
  "attemptedWarrantsServed", "forceDisplays", "vehicleExtractions", "evo",
] as const;
const RATING_CODES = ["NO", "A", "RT", "UA", "NRT"] as const;
type RatingCode = typeof RATING_CODES[number];
type JsonRecord = Record<string, unknown>;
type PacketReportRow = { report: unknown; record_date?: string; date?: string };

export type PacketPoPeriodTotals = {
  start_date: string;
  end_date: string;
  log_count: number;
  reviewed_log_count: number;
  activity: Record<(typeof ACTIVITY_KEYS)[number], number>;
  rating_counts: Record<RatingCode, number>;
  reviewed_run_checklists: number;
  total_runs: number;
};
export type PacketPoTotals = {
  daily: PacketPoPeriodTotals;
  weekly: PacketPoPeriodTotals;
  monthly: PacketPoPeriodTotals;
  unacceptable_details: PacketPoUaDetail[];
};
export type PacketPoUaDetail = {
  record_date: string;
  category_key: string;
  rating: "UA";
  justification: string;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const reportOf = (row: PacketReportRow): JsonRecord => isRecord(row.report) ? row.report : {};
const dateOf = (row: PacketReportRow): string =>
  typeof row.record_date === "string" ? row.record_date :
    typeof reportOf(row).date === "string" ? reportOf(row).date as string : "";
const count = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

function emptyActivity(): PacketPoPeriodTotals["activity"] {
  return Object.fromEntries(ACTIVITY_KEYS.map(key => [key, 0])) as PacketPoPeriodTotals["activity"];
}

function addActivity(activity: PacketPoPeriodTotals["activity"], key: string, amount = 1) {
  if ((ACTIVITY_KEYS as readonly string[]).includes(key)) {
    activity[key as keyof typeof activity] += amount;
  }
}

function reportActivity(report: JsonRecord, activity: PacketPoPeriodTotals["activity"]) {
  const raw = isRecord(report.activity) ? report.activity : {};
  for (const key of ACTIVITY_KEYS) activity[key] += count(raw[key]);

  const runs = Array.isArray(report.runs) ? report.runs : [];
  const countedArrests = new Set<string>();
  for (const runValue of runs) {
    if (!isRecord(runValue) || runValue.formStatus !== "complete" || !runValue.checklistReviewedAt) continue;
    const run = runValue;
    const code = typeof run.clearanceCode === "string" ? run.clearanceCode : "";
    const uniqueArrest = code === "3V" && run.arrestMade === true && run.transportedAfterArrest === true &&
      !countedArrests.has(typeof run.id === "string" ? run.id : "");
    if (uniqueArrest) countedArrests.add(typeof run.id === "string" ? run.id : "");

    if (run.clearanceRulesVersion === 1 && code === "1V") {
      if (isRecord(run.activityFlags) && run.activityFlags.trafficCitations === true) addActivity(activity, "trafficCitations");
      else if (run.runKind === "traffic_stop" ||
        (isRecord(run.activityFlags) && run.activityFlags.solveCitationSummons === true)) {
        addActivity(activity, "solveCitationSummons");
      } else addActivity(activity, "premierOneReports");
    } else if (run.clearanceRulesVersion === 1 && uniqueArrest) {
      addActivity(activity, "u10100Reports");
      addActivity(activity, "prisonersSlated");
      addActivity(activity, "premierOneReports");
      if (run.arrestClassificationVersion !== 1 || run.arrestType === "On-view") {
        addActivity(activity, "pcAffidavits");
      }
    }
    if (uniqueArrest && run.arrestClassificationVersion === 1) {
      if (run.arrestSeverity === "Felony") addActivity(activity, "felonyArrests");
      if (run.arrestSeverity === "Misdemeanor") addActivity(activity, "misdemeanorArrests");
      if (run.arrestType === "Warrant") addActivity(activity, "attemptedWarrantsServed");
      if (run.clearanceRulesVersion !== 1 && run.arrestType === "On-view") addActivity(activity, "pcAffidavits");
    }
    if (code && code !== "4V" && run.runKind === "traffic_stop") addActivity(activity, "trafficStops");
  }
}

/** Officer Safety categories count one UA per day (client OFFICER_SAFETY_LOCK_CATEGORIES). */
const OFFICER_SAFETY_CATEGORIES = new Set([
  "threatAssessment", "initiatingArrests", "handlingPrisoners", "vehicleStops", "runApproach", "buildingSearch", "patDownSearches",
]);

function hasDeficiency(report: JsonRecord, category: string): boolean {
  const groups = Array.isArray(report.checklistDeficiencies) ? report.checklistDeficiencies : [];
  return groups.some(group => isRecord(group) && group.category === category);
}

/**
 * Mirrors the client applyUaCounting rule (owner, Nov 26-27, 2026): one UA per category per run, checklist UA's
 * before added ones, and Officer Safety categories once per day on the first run by time.
 */
function countedUaByCategory(report: JsonRecord): Map<string, number> {
  const runs = Array.isArray(report.runs) ? report.runs.filter(isRecord) : [];
  const order = new Map([...runs].sort((left, right) => Date.parse(String(left.occurredAt ?? "")) - Date.parse(String(right.occurredAt ?? "")))
    .map((run, index) => [String(run.id), index]));
  const groups = (Array.isArray(report.checklistDeficiencies) ? report.checklistDeficiencies : []).filter(isRecord)
    .filter(group => typeof group.category === "string");
  const position = (group: JsonRecord) => typeof group.runId === "string" ? order.get(group.runId) ?? Number.MAX_SAFE_INTEGER : -1;
  const ordered = groups.map((group, index) => ({ group, index })).sort((left, right) =>
    position(left.group) - position(right.group) || Number(left.group.added === true) - Number(right.group.added === true) || left.index - right.index);
  const runKeys = new Set<string>();
  const days = new Set<string>();
  const counts = new Map<string, number>();
  for (const { group } of ordered) {
    const category = String(group.category);
    const runKey = `${typeof group.runId === "string" ? group.runId : "duty"}:${category}`;
    if (runKeys.has(runKey) || (OFFICER_SAFETY_CATEGORIES.has(category) && days.has(category))) continue;
    runKeys.add(runKey);
    if (OFFICER_SAFETY_CATEGORIES.has(category)) days.add(category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

function ratingOf(value: unknown): RatingCode | null {
  const code = isRecord(value) ? value.rating : value;
  return typeof code === "string" && (RATING_CODES as readonly string[]).includes(code)
    ? code as RatingCode : null;
}

function makeTotals(rows: PacketReportRow[], start: string, end: string): PacketPoPeriodTotals {
  const totals: PacketPoPeriodTotals = {
    start_date: start, end_date: end, log_count: rows.length, reviewed_log_count: 0,
    activity: emptyActivity(), rating_counts: { NO: 0, A: 0, RT: 0, UA: 0, NRT: 0 },
    reviewed_run_checklists: 0, total_runs: 0,
  };
  for (const row of rows) {
    const report = reportOf(row);
    reportActivity(report, totals.activity);
    const runs = Array.isArray(report.runs) ? report.runs : [];
    totals.total_runs += runs.length;
    totals.reviewed_run_checklists += runs.filter(run =>
      isRecord(run) && run.formStatus === "complete" && Boolean(run.checklistReviewedAt)).length;
    if (report.ratingsReviewedAt && report.limboDay !== true) {
      totals.reviewed_log_count++;
      if (isRecord(report.ratings)) {
        const counted = countedUaByCategory(report);
        const notApplicable = new Set(Array.isArray(report.notApplicableCategories) ? report.notApplicableCategories : []);
        for (const [category, entry] of Object.entries(report.ratings)) {
          const rating = ratingOf(entry);
          const groups = counted.get(category) ?? 0;
          if (groups > 0 && rating !== "NRT") { totals.rating_counts.UA += groups; continue; }
          if (notApplicable.has(category) && rating !== "UA" && !hasDeficiency(report, category)) continue;
          if (rating) totals.rating_counts[rating]++;
        }
      }
    }
  }
  return totals;
}

function unacceptableDetails(rows: PacketReportRow[]): PacketPoUaDetail[] {
  return rows.flatMap(row => {
    const report = reportOf(row);
    if (!report.ratingsReviewedAt || report.limboDay === true || !isRecord(report.ratings)) return [];
    const recordDate = dateOf(row);
    return Object.entries(report.ratings).flatMap(([categoryKey, entry]) => {
      if (ratingOf(entry) !== "UA") return [];
      const justification = isRecord(entry) && typeof entry.justification === "string"
        ? entry.justification : "";
      return [{ record_date: recordDate, category_key: categoryKey, rating: "UA" as const, justification }];
    });
  });
}

function dateAtUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function monthRange(date: string): [string, string] {
  const start = `${date.slice(0, 7)}-01`;
  const next = new Date(`${start}T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return [start, dateString(next)];
}
function weekRange(date: string): [string, string] {
  const start = dateAtUtc(date);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return [dateString(start), dateString(end)];
}

/** Returns only daily, Sunday–Saturday weekly, and calendar-month totals. */
export function summarizePacketPoTotals(rows: PacketReportRow[], targetDate: string): PacketPoTotals {
  const [weekStart, weekEnd] = weekRange(targetDate);
  const [monthStart, monthEnd] = monthRange(targetDate);
  const byDate = rows.filter(row => dateOf(row) <= targetDate);
  const uniqueRows = [...new Map(byDate.map(row => [dateOf(row), row])).values()];
  const daily = uniqueRows.filter(row => dateOf(row) === targetDate);
  const weekly = uniqueRows.filter(row => dateOf(row) >= weekStart && dateOf(row) <= targetDate);
  const monthly = uniqueRows.filter(row => dateOf(row) >= monthStart && dateOf(row) <= targetDate);
  return {
    daily: makeTotals(daily, targetDate, targetDate),
    weekly: makeTotals(weekly, weekStart, weekEnd),
    monthly: makeTotals(monthly, monthStart, monthEnd),
    unacceptable_details: unacceptableDetails(monthly),
  };
}
