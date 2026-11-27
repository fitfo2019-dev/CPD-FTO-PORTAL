// FTO Portal training deck. Regenerate after each merge to main:
//   node build-deck.mjs  (writes FTO-Portal-Training-Deck.pptx next to this file)
// Facts come from the 2026 FTO Manual (page numbers from a PDF render of the .docx)
// and the rule code in lib/po-progress (PO-STD-2, PO-SCORE-2, PO-NRT-1).
import * as S from "/home/user/.perplexity/skills/office/pptx/scripts/framework.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = "Version 4 · November 26, 2026 · portal main 921d984";

const NAVY = "1F3A68";
S.setTheme({
  colors: { accent: NAVY },
  series: [NAVY, "B8BCB6", "0F2340", "BFCBDD", "944454"],
  stackSeries: [NAVY, "0F2340", "944454", "848456", "6E522B"],
});
const { T, R, L, C } = S;
const deck = S.newDeck();
deck.title = "Field Training Portal: Rules, Workflows and FTO Instruction";

// Status colors used by the portal tiles.
const ST = { meets: "2E7D4F", emerging: "9E6012", below: "B23A3A", nrt: "6B3FA0" };

const M = (p, extra = "") => ({ name: `2026 FTO Manual p. ${p}${extra}`, kind: "user" });
const CODE = (f) => ({ name: `Portal rule code ${f}`, kind: "internal" });
const LOG = { name: "Owner decision log (docs/rebuild/DECISIONS_LOG.md)", kind: "internal" };

let page = 2;
const fr = (o) => ({ ...o, page: ++page });

// Rounded card with a heading and body, drawn from native primitives.
function card(s, id, x, y, w, h, heading, body, o = {}) {
  s.addShape("roundRect", {
    objectName: `${id}_box`, x: S.px(x), y: S.px(y), w: S.px(w), h: S.px(h),
    fill: { color: o.fill || C.surface }, line: { color: C.border, width: 0.75 }, rectRadius: 0.08,
  });
  let yy = y + 34;
  if (o.tag) {
    T(s, `${id}_tag`, o.tag, { x: x + 20, y: yy, role: "label", mono: true, color: o.tagColor || C.muted, w: w - 40 });
    yy += 30;
  }
  T(s, `${id}_heading`, heading, { x: x + 20, y: yy, role: "body", bold: true, w: w - 40, lines: o.hl || 1, lh: 24 });
  yy += (o.hl || 1) * 24 + 10;
  if (body) T(s, `${id}_body`, body, { x: x + 20, y: yy, role: o.bodyRole || "compact", color: C.secondary, w: w - 40, lines: o.bl || 4, lh: o.bodyRole === "body" ? 24 : 22 });
  if (o.ref) {
    L(s, `${id}_ref_rule`, x + 20, y + h - 52, x + w - 20, y + h - 52);
    T(s, `${id}_ref`, o.ref, { x: x + 20, y: y + h - 22, role: "compact", bold: true, color: NAVY, w: w - 40 });
  }
}

// Numbered process flow across the slide.
function flow(s, top, items, o = {}) {
  const n = items.length, gap = 18, w = (1128 - gap * (n - 1)) / n, h = o.h || 250;
  items.forEach((it, i) => {
    const x = 76 + i * (w + gap);
    card(s, `step_${i + 1}`, x, top, w, h, it.h, it.b, { tag: `STEP ${i + 1}`, tagColor: NAVY, hl: it.hl || 2, bl: it.bl || 7, fill: it.fill, ref: it.r, bodyRole: "body" });
  });
}

function pill(s, id, x, y, w, label, color) {
  s.addShape("roundRect", { objectName: `${id}_pill`, x: S.px(x), y: S.px(y), w: S.px(w), h: S.px(30), fill: { color }, line: { type: "none" }, rectRadius: 0.1 });
  T(s, `${id}_label`, label, { x, y: y + 21, role: "label", bold: true, color: "FFFFFF", w, align: "center" });
}

// ---------------------------------------------------------------- 1 Cover
S.layouts.photoCover(deck.addSlide(), {
  image: { path: join(HERE, "cruiser-lights.jpg"), width: 1600, height: 900, altText: "Police cruiser light bar lit red and blue on a city street at night" },
  brand: "COLUMBUS DIVISION OF POLICE",
  kicker: "FIELD TRAINING OFFICE",
  title: "How the FTO Portal applies the 2026 FTO Manual",
  subtitle: "Rules, workflows, scoring and how to teach FTO's to use it",
  date: "November 26, 2026",
  overlay: { color: "000000", opacity: 0.45 },
});

// ---------------------------------------------------------------- 2 Agenda
S.layouts.agenda(deck.addSlide(), {
  title: "This briefing moves from the portal to the rules to the teaching plan",
  sections: [
    { id: "portal", label: "The portal, roles and program structure" },
    { id: "work", label: "Daily, weekly and phase workflows" },
    { id: "ratings", label: "Ratings and Not Responding to Training" },
    { id: "score", label: "PO status and score, step by step" },
    { id: "teach", label: "Teaching FTO's and keeping this deck current" },
  ],
});

// ---------------------------------------------------------------- 3 What the portal is
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "THE PORTAL",
    headline: "The portal fills in the paperwork and does the math so FTO's can train",
    sources: [LOG],
  });
  const b = S.frame(s, f);
  const w = (1128 - 2 * 24) / 3, h = b.bottom - b.top - 10;
  card(s, "c1", 76, b.top, w, h, "Enter once, reuse everywhere", "Names, badges, class, phase, week and date fill every form header automatically. FTO's log a run in three taps and finish checklists and narratives later.", { tag: "LESS TYPING", hl: 2, bl: 7, bodyRole: "body", ref: "DECISION LOG" });
  card(s, "c2", 76 + w + 24, b.top, w, h, "Same manual, same rules for every PO", "Ratings, limbo days, deadlines and the PO standard follow the 2026 FTO Manual and the owner's decision log. Rule versions apply going forward only.", { tag: "CONSISTENCY", hl: 2, bl: 7, bodyRole: "body", ref: "RULES PO-STD-2, PO-SCORE-2" });
  card(s, "c3", 76 + 2 * (w + 24), b.top, w, h, "Advisory, not a decision", "Status, score and the NRT recommendation help the FTO and the FTO Office see patterns. The FTO rates, and the FTO Office decides on NRT outcomes and release.", { tag: "FTO JUDGMENT", hl: 2, bl: 7, bodyRole: "body", ref: "MANUAL P. 18" });
}

// ---------------------------------------------------------------- 4 Roles
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "THE PORTAL / ROLES",
    headline: "Each role sees only the pages its job needs",
    note: "Pages marked preview are built and visible in the preview build until their server routes are connected. Resources holds each role's own workflows and how-to's.",
    sources: [{ name: "Portal sidebar (components/shell.tsx)", kind: "internal" }, LOG],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Role", "Main pages", "What the role does there"],
      colW: [0.2, 0.42, 0.38],
      rows: [
        ["PO", "My Training (Review and Sign), Resources", "Reviews and confirms their own UA totals"],
        ["FTO", "Daily Packet, Shifts & Runs, Scheduling, Weekly Packets", "Documents each tour and submits packets"],
        ["FTO Coordinator", "Dashboard, Review Desk, Probationary Officers, Assignments", "Reviews packets, sets up phases, watches PO standing"],
        ["FTO Sergeant", "Dashboard, PO Progress (preview), Weekly Packets", "Oversees the program and reviews alerts"],
        ["FTO Chain of Command", "Submitted Packets, Resources", "Reads finished packets"],
        ["POLICENET", "Technical Access, Help Desk", "Prepares and tests technical changes"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 5 Program structure
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "THE PORTAL / PROGRAM",
    headline: "Fifteen weeks in four phases, each opening with unrated limbo days",
    note: "Academy is the set-up step where Coordinators introduce the program to the recruit class (p. 7).",
    sources: [M(16), M(17), M(18), M(7)],
  });
  S.layouts.matrix(s, {
    frame: f,
    matrix: {
      columns: ["Phase I", "Phase II", "Phase III", "Phase IV", "Probationary"],
      rowLabels: ["Weeks", "Limbo (not rated)", "Focus"],
      cells: [
        ["1-4", "5-8", "9-12", "13-15", "365 days after graduation"],
        ["All of week 1", "Week 5, days 1-2", "Week 9, day 1", "Week 13, day 1", "None"],
        ["Report writing, traffic", "Adds conflict, arrests", "Self-initiated activity", "Works independently", "Sergeant evaluates"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 6 Daily packet workflow
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "WORKFLOWS / DAILY PACKET",
    headline: "A daily packet goes from quick run capture to one rating per category",
    sources: [M(3), M(29), LOG],
  });
  const b = S.frame(s, f);
  flow(s, b.top, [
    { h: "Add each run", b: "Three taps save the incident number and run type.", r: "DECISION LOG" },
    { h: "Finish the checklist", b: "Each unchecked item is a UA, one per category per run page.", r: "MANUAL P. 3" },
    { h: "Explain in the Daily Log", b: "One explanation per category, with corrective training and minutes.", r: "MANUAL P. 3, 41" },
    { h: "Rate 38 categories", b: "One rating per category; none on limbo days.", r: "MANUAL P. 18, 29" },
    { h: "Save, then finalize", b: "Save keeps a private draft; Finalize sends it on.", r: "DECISION LOG" },
  ], { h: b.bottom - b.top - 10 });
}

// ---------------------------------------------------------------- 7 Two-stage submission
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "WORKFLOWS / SUBMISSION",
    headline: "A daily packet stays out of the Coordinator's queue until the FTO clicks Finalize",
    sources: [LOG],
  });
  S.layouts.comparison(s, {
    frame: f,
    criteria: ["Saved as", "Who can see it", "Can it change", "How it happens"],
    a: { tag: "STAGE 1", heading: "Local draft", rows: ["local_draft_pending", "The FTO only, hidden from the Review Desk", "Yes, the FTO keeps editing", "Automatic saves and SAVE LOCAL DRAFT"] },
    b: { tag: "STAGE 2", heading: "Submitted packet", rows: ["submitted_complete", "The Coordinator's Review Desk", "Locked; only flagged pages reopen", "FINALIZE AND SUBMIT TO COORDINATOR"] },
  });
}

// ---------------------------------------------------------------- 8 Weekly packet
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "WORKFLOWS / WEEKLY PACKET",
    headline: "The weekly packet needs the PO's signature and is due three days after the workweek",
    sources: [M(41), LOG],
  });
  S.layouts.paired(s, {
    frame: f,
    leftHeading: "WHAT HAPPENS",
    rightHeading: "WHY IT MATTERS",
    pairs: [
      { left: "The Weekly Performance Log lists each deficient category, the corrective training and its minutes", right: "This is the retraining record the NRT rule and later reviews depend on" },
      { left: "The PO reviews and signs on the FTO laptop or in their own account", right: "Only signed weeks count toward status and score" },
      { left: "Due 3 days after the workweek; notice on day 2, overdue on day 4", right: "Late packets are tracked but do not affect PO status" },
      { left: "The Coordinator formally reviews; a correction reopens only the flagged pages", right: "Earlier versions are kept with a timestamp" },
    ],
  });
}

// ---------------------------------------------------------------- 9 Phase setup
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "WORKFLOWS / PHASE SETUP",
    headline: "Phase Sign-Up matches rested FTO's first to keep assignments fair",
    sources: [LOG],
  });
  const b = S.frame(s, f);
  const w = (1128 - 24) / 2, h = Math.min(170, (b.bottom - b.top - 24) / 2);
  card(s, "p1", 76, b.top, w, h, "Rested First matching", "FTO's who did not coach the phase just before are matched first. Back-to-back FTO's are matched if PO's remain.", { bl: 3, bodyRole: "body" });
  card(s, "p2", 76 + w + 24, b.top, w, h, "Tie-breakers in order", "Longest time since the last phase ended, then fewest phases this calendar year, then earliest sign-up.", { bl: 3, bodyRole: "body" });
  card(s, "p3", 76, b.top + h + 24, w, h, "Senior FTO for Phase IV", "Set automatically after 4 completed full phases as the assigned FTO.", { bl: 3, bodyRole: "body" });
  card(s, "p4", 76 + w + 24, b.top + h + 24, w, h, "Extensions", "The Coordinator enters extension days; later dates and week numbers shift automatically.", { bl: 3, bodyRole: "body" });
}

// ---------------------------------------------------------------- 10 Ratings
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "RATINGS",
    headline: "FTO's choose one of five manual ratings for each of the 38 categories",
    sources: [M(4), M(18), M(29)],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Rating", "When the FTO uses it", "How the portal counts it"],
      colW: [0.3, 0.38, 0.32],
      rows: [
        ["Acceptable (A)", "Performance meets the Standard Evaluation Guidelines", "No deficiency"],
        ["Responding to Training (RT)", "Improving with training", "No deficiency"],
        ["Unacceptable (UA)", "Below the guidelines; documented, retrained", "One UA toward status and score"],
        ["Not Responding to Training (NRT)", "Paired with a UA; a pattern despite retraining", "Counts as 20 UA's in place of its UA"],
        ["Not Observed (NO)", "The task did not come up that tour", "Not counted"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 11 NRT definition
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "RATINGS / NRT",
    headline: "The manual ties an NRT to one specific task that retraining has not fixed",
    sources: [M(3), M(15), M(18)],
  });
  const b = S.frame(s, f);
  s.addShape("rect", { objectName: "quote_box", x: S.px(76), y: S.px(b.top), w: S.px(600), h: S.px(b.bottom - b.top - 10), fill: { color: NAVY }, line: { type: "none" } });
  T(s, "quote_tag", "2026 FTO MANUAL, DEFINITIONS (P. 3)", { x: 104, y: b.top + 40, role: "label", mono: true, color: "D9E1EE", w: 544 });
  T(s, "quote", "\u201cA pattern of documented poor/deficient performance in a specific job function, patrol task, and/or paperwork - despite receiving corrective re\u2011training to address the performance\u2026 used in conjunction with an \u2018Unacceptable\u2019 rating.\u201d", { x: 104, y: b.top + 84, role: "analytical", color: "FFFFFF", w: 544, lines: 6, lh: 30 });
  L(s, "quote_rule", 104, b.top + 280, 648, b.top + 280, "4A6491");
  T(s, "quote2_tag", "RATING INSTRUCTIONS (P. 18)", { x: 104, y: b.top + 316, role: "label", mono: true, color: "D9E1EE", w: 544 });
  T(s, "quote2", "\u201cThe FTO will review prior documentation in the performance category being considered for the rating.\u201d", { x: 104, y: b.top + 350, role: "body", color: "FFFFFF", w: 544, lines: 3, lh: 24 });
  const x = 716, w = 488, ch = (b.bottom - b.top - 10 - 2 * 18) / 3;
  card(s, "n1", x, b.top, w, ch, "Before rating NRT", "Review prior documentation in that category and confirm enough training was given (p. 18).", { bl: 2 });
  card(s, "n2", x, b.top + ch + 18, w, ch, "Right after rating NRT", "Contact the FTO Office immediately; Coordinators and FTO Sergeant are notified (p. 15, 18).", { bl: 2 });
  card(s, "n3", x, b.top + 2 * (ch + 18), w, ch, "Why a category is too broad", "Three different UA's in one category, each retrained once, is not a pattern on one task.", { bl: 2 });
}

// ---------------------------------------------------------------- 12 NRT recommendation (PO-NRT-1)
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "RATINGS / NRT RECOMMENDATION (SCREEN IN BUILD)",
    headline: "After two documented retrainings, a third UA on that task brings an NRT advisory",
    note: "Rule PO-NRT-1 logic is merged; its screen and notice are approved and being built. The FTO decides.",
    sources: [CODE("nrt.ts"), M(3)],
  });
  const b = S.frame(s, f);
  flow(s, b.top, [
    { h: "1st UA on a task", b: "Example: PO fails to recognize a weapon on a person. FTO retrains and records minutes.", r: "MANUAL P. 3, 41" },
    { h: "2nd UA, same task", b: "Retraining must be documented before the next failure, or the portal asks for it.", r: "RULE PO-NRT-1" },
    { h: "3rd UA, same phase", b: "Both earlier UA's were retrained in time, so NRT is recommended.", r: "MANUAL P. 3, 18" },
    { h: "FTO decides", b: "FTO selects supporting entries; entries from earlier phases start unselected.", r: "MANUAL P. 18" },
    { h: "Notice goes out", b: "Sent at once to Coordinators and FTO Sergeant while the packet stays a draft.", r: "MANUAL P. 15, 18" },
  ], { h: b.bottom - b.top - 10 });
}

// ---------------------------------------------------------------- 13 Status: three rules
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "STATUS / PO-STD-2",
    headline: "PO status after each signed week is the most serious result of three rules",
    note: "Unsigned weeks and limbo weeks do not count. Weeks rated before November 26, 2026 keep the earlier rule PO-STD-1.",
    sources: [CODE("data.ts"), LOG],
  });
  const b = S.frame(s, f);
  const w = (1128 - 2 * 24) / 3, h = b.bottom - b.top - 10;
  card(s, "r1", 76, b.top, w, h, "Weekly rule", "UA's per 40 rated hours against the phase limits. Three or more UA's on the same task in one week is Below Standard. Each week that meets standard steps this rule down one level.", { tag: "RULE 1", tagColor: NAVY, bl: 8, bodyRole: "body", ref: "OWNER RULE · MANUAL P. 16" });
  card(s, "r2", 76 + w + 24, b.top, w, h, "Category in phase", "10 to 14 UA's in one category during the phase is Emerging Concern. 15 or more is Below Standard. The count resets at each new phase.", { tag: "RULE 2", tagColor: NAVY, bl: 8, bodyRole: "body", ref: "OWNER RULE · MANUAL P. 18" });
  card(s, "r3", 76 + 2 * (w + 24), b.top, w, h, "NRT hold", "An NRT holds the PO at Below Standard until the FTO Office records the NRT meeting outcome. Normal rules resume after that.", { tag: "RULE 3", tagColor: NAVY, bl: 8, bodyRole: "body", ref: "OWNER RULE · MANUAL P. 15, 18" });
}

// ---------------------------------------------------------------- 14 Weekly limits table
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "STATUS / WEEKLY LIMITS",
    headline: "Weekly limits tighten each phase because a Phase IV PO should work independently",
    note: "The Emerging Concern and Below Standard columns are UA's per 40 rated hours; the same-task column counts actual UA's. Limits were set by owner decision on November 26, 2026. The manual expects independent work by Phase IV (p. 16). The same-task and category rules apply in every phase.",
    sources: [M(16), CODE("data.ts")],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Phase", "Emerging Concern", "Below Standard", "Same task, one week"],
      colW: [0.22, 0.26, 0.26, 0.26],
      rows: [
        ["Phase I", "12", "24", "3 or more is Below Standard"],
        ["Phase II", "10", "20", "3 or more is Below Standard"],
        ["Phase III", "8", "16", "3 or more is Below Standard"],
        ["Phase IV", "5", "10", "3 or more is Below Standard"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 15 Rated hours
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "SCORE / RATED HOURS",
    headline: "Scaling to 40 rated hours treats short weeks and both schedules alike",
    note: "Rated hours fill in automatically and the FTO can correct them. Results are rounded to one decimal.",
    sources: [CODE("data.ts"), M(18)],
  });
  const b = S.frame(s, f);
  const lw = 520;
  card(s, "formula", 76, b.top, lw, 300, "Two formulas", null, { tag: "BY HAND" });
  T(s, "f1", "Rated hours = shift length \u00d7 rated days", { x: 96, y: b.top + 120, role: "analytical", bold: true, color: NAVY, w: lw - 40, lines: 2, lh: 28 });
  T(s, "f1b", "4x10 = 10 hours a day; 5x8 = 8 hours a day", { x: 96, y: b.top + 186, role: "compact", color: C.secondary, w: lw - 40, lines: 2, lh: 22 });
  T(s, "f2", "Per 40 = counted UA's \u00d7 40 \u00f7 rated hours", { x: 96, y: b.top + 262, role: "analytical", bold: true, color: NAVY, w: lw - 40, lines: 2, lh: 28 });
  S.table(s, { x: 616, y: b.top, w: 588, h: 300 }, {
    headers: ["Week (5x8)", "Days", "Hours", "UA's", "Per 40"],
    rows: [
      ["Full week", "5", "40", "3", "3.0"],
      ["Week 5, 2 limbo days", "3", "24", "1", "1.7"],
      ["Week 13, 1 limbo day", "4", "32", "2", "2.5"],
    ],
    colW: [0.4, 0.14, 0.15, 0.14, 0.17],
  });
}

// ---------------------------------------------------------------- 16 Week score curve
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "SCORE / PO-SCORE-2",
    headline: "A week starts at 100% and loses 2 points per counted UA through 20, then 1 point",
    note: "Counted UA's = UA's minus NRT's plus 20 per NRT, scaled per 40 rated hours. The week score is then at most 60% if the week ends Below Standard and at most 80% if Emerging Concern.",
    sources: [CODE("data.ts")],
  });
  const b = S.frame(s, f);
  T(s, "chart_heading", "Base week score (%) before any status cap", { x: 76, y: b.top + 20, role: "body", bold: true, w: 700 });
  const xs = [0, 5, 10, 20, 40, 80], ys = [100, 90, 80, 60, 40, 0];
  const base = b.bottom - 56, top = b.top + 70, ph = base - top, bw = 80, gap = (700 - 6 * bw) / 5;
  xs.forEach((u, i) => {
    const x = 76 + i * (bw + gap), hh = ph * ys[i] / 100;
    if (hh > 0) R(s, `bar_${i}`, x, base - hh, bw, hh, u === 20 ? NAVY : C.bar);
    T(s, `bar_${i}_value`, `${ys[i]}%`, { x, y: base - hh - 10, role: "compact", bold: true, w: bw, align: "center" });
    T(s, `bar_${i}_label`, String(u), { x, y: base + 24, role: "compact", w: bw, align: "center" });
  });
  L(s, "axis", 76, base, 776, base);
  T(s, "axis_title", "Counted UA's per 40 rated hours", { x: 76, y: base + 50, role: "compact", color: C.secondary, w: 700 });
  const px0 = 860, pw = 344;
  [["One NRT in a 40-hour week", "20 counted units gives a base score of 60%"], ["Zero at 80", "The score never goes below 0%"], ["One scale", "The same curve applies in every phase"]].forEach(([h, t], i) => {
    const y = b.top + 20 + i * 110;
    T(s, `point_${i}_h`, h, { x: px0, y, role: "body", bold: true, color: NAVY, w: pw });
    T(s, `point_${i}`, t, { x: px0, y: y + 28, role: "body", color: C.secondary, w: pw, lines: 2, lh: 24 });
  });
}

// ---------------------------------------------------------------- 17 Phase score and tiles
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "SCORE / PHASE",
    headline: "The phase score is the average of signed weeks, capped when a phase flag is set",
    sources: [CODE("data.ts"), LOG],
  });
  const b = S.frame(s, f);
  const lw = 560;
  T(s, "avg_h", "Phase score = average of the phase's scored weeks, to one decimal", { x: 76, y: b.top + 24, role: "analytical", bold: true, w: lw, lines: 2, lh: 28 });
  const rows = [
    ["Held to 60%", "An NRT in the phase, or 15+ UA's in one category"],
    ["Held to 80%", "10 to 14 UA's in one category in the phase"],
    ["No cap", "No phase flag; the average stands"],
  ];
  rows.forEach((r, i) => {
    const y = b.top + 90 + i * 76;
    L(s, `cap_rule_${i}`, 76, y, 76 + lw, y);
    T(s, `cap_${i}`, r[0], { x: 76, y: y + 32, role: "body", bold: true, color: NAVY, w: 160 });
    T(s, `cap_${i}_why`, r[1], { x: 246, y: y + 32, role: "body", color: C.secondary, w: lw - 170, lines: 2, lh: 22 });
  });
  const tx = 700, tw = 504;
  T(s, "tiles_h", "Tile color shows the worst status in the phase", { x: tx, y: b.top + 24, role: "body", bold: true, w: tw, lines: 2, lh: 24 });
  const tiles = [["MEETS STANDARD", ST.meets], ["EMERGING CONCERN", ST.emerging], ["BELOW STANDARD", ST.below], ["NRT IN PHASE", ST.nrt]];
  tiles.forEach(([lab, col], i) => pill(s, `tile_${i}`, tx, b.top + 90 + i * 52, 260, lab, col));
  T(s, "po_view", "The PO sees only the status label, updated when each weekly packet is signed. This view is in preview.", { x: tx, y: b.top + 320, role: "compact", color: C.secondary, w: tw, lines: 3, lh: 22 });
}

// ---------------------------------------------------------------- 18 Worked example
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "SCORE / WORKED EXAMPLE",
    headline: "One NRT holds sample PO Mason Novak's Phase IV score at 60%",
    note: "Mason Novak is a sample PO in the portal's demonstration data, 5x8 schedule. Show Calculation on PO Progress displays these same rows.",
    sources: [CODE("data.ts"), { name: "PO Progress sample data", kind: "fictional" }],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Step", "Week 13", "Week 14", "Phase IV"],
      colW: [0.31, 0.23, 0.23, 0.23],
      rows: [
        ["Rated days and hours", "4 days, 32 hours", "5 days, 40 hours", ""],
        ["UA's and NRT's", "2 UA's, 0 NRT", "8 UA's, 1 NRT", ""],
        ["Counted UA's", "2", "8 \u2212 1 + 20 = 27", ""],
        ["Per 40 rated hours", "2 \u00d7 40 \u00f7 32 = 2.5", "27 \u00d7 40 \u00f7 40 = 27", ""],
        ["Week score", "100 \u2212 2 \u00d7 2.5 = 95%", "60 \u2212 (27 \u2212 20) = 53%", "(95 + 53) \u00f7 2 = 74%"],
        ["Status and cap", "Meets Standard", "Below Standard (NRT)", "Held to 60% (NRT)"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 19 Litigation
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "WHY IT HOLDS UP",
    headline: "The calculation is built to be reproduced by hand and defended in review",
    sources: [LOG, CODE("standard.test.ts, score.test.ts, nrt.test.ts")],
  });
  S.layouts.paired(s, {
    frame: f,
    leftHeading: "SAFEGUARD",
    rightHeading: "WHAT IT PREVENTS",
    pairs: [
      { left: "Only PO-signed weeks count", right: "Scoring unreviewed or draft paperwork" },
      { left: "Every rule has a version and an effective date", right: "Changing a PO's past results after the fact" },
      { left: "The same fixed limits apply to every PO in a phase", right: "Different treatment of PO's in the same phase" },
      { left: "Show Calculation lists each week's numbers and cap reason", right: "A result no one can check by hand" },
      { left: "Status, score and NRT advice are advisory only", right: "The portal replacing the FTO's judgment" },
    ],
  });
}

// ---------------------------------------------------------------- 19b Charging lookup and Resources
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "RESOURCES / CHARGING LOOKUP",
    headline: "The charging lookup goes from offense to elements to wording",
    note: "FTO-only on the Arrest and OVI run pages; PO's use it under FTO direction during training. Entries that conflict with the current code stay locked until the FTO Office approves the wording.",
    sources: [{ name: "Columbus Criminal Complaint Manual (Resources)", kind: "user" }, { name: "Felony Traffic Processing Guidelines and Wording Manual, Rev. 02/2023", kind: "user" }, { name: "Ohio Revised Code, codes.ohio.gov", kind: "user" }, LOG],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Step", "What the FTO sees", "Teaching point"],
      colW: [0.18, 0.46, 0.36],
      rows: [
        ["1 Offense", "Offense, section and penalty, word for word", "Confirm the level before writing"],
        ["2 Statute", "Statute divisions as a checklist", "Check each element the facts support"],
        ["3 Wording", "Manual wording; Copy after the checks", "Fill every blank with the facts"],
        ["OVI", "Citation if misdemeanor; felony by D.I.C.E.", "No Copy for OVI wording"],
        ["Resources", "Complaint and felony traffic manuals, street cards", "Example contacts are placeholders"],
        ["Substation", "Filled from the assignment; still editable", "Correct it for a different substation"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 20 Teaching plan
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "TEACHING FTO'S",
    headline: "Teach FTO's in four passes, from explaining the rules to checking their packets",
    note: "Suggested sequence for in-service or new-FTO training; the FTO Office sets the actual schedule.",
    sources: [M(7), LOG],
  });
  S.layouts.matrix(s, {
    frame: f,
    matrix: {
      columns: ["Explain", "Show", "Practice", "Check"],
      rowLabels: ["Trainer does", "FTO does", "Done when"],
      cells: [
        ["Walk through slides 5 to 18", "Open a sample PO in the portal", "Give a sample tour to document", "Review the FTO's first real packet"],
        ["Asks about limbo, ratings and NRT", "Follows Show Calculation by hand", "Logs runs, rates, saves, finalizes", "Fixes any flagged page"],
        ["FTO can state the three rules", "FTO reproduces one week's score", "Packet submits with no errors", "First week signed on time"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 21 Habits
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "TEACHING FTO'S / HABITS",
    headline: "Five FTO habits keep every rating, score and NRT accurate",
    sources: [M(3), M(15), M(18), M(29), M(48)],
  });
  S.layouts.table(s, {
    frame: f,
    table: {
      headers: ["Habit", "Why it matters", "Manual"],
      colW: [0.4, 0.45, 0.15],
      rows: [
        ["Log corrective training and minutes for each UA", "Without it the NRT rule asks for retraining instead", "p. 3, 41"],
        ["Leave limbo days unrated", "Limbo days never count toward status", "p. 18, 29"],
        ["Tick \u201csame issue\u201d on narrative-only categories", "This links repeat UA's to one task", "p. 3"],
        ["Call the FTO Office right away on an NRT", "The Office can intervene during training", "p. 15, 48"],
        ["Finalize only when the packet is complete", "Finalize sends it to the Coordinator", "p. 29"],
      ],
    },
  });
}

// ---------------------------------------------------------------- 22 Built vs planned
{
  const s = deck.addSlide();
  const f = fr({
    kicker: "STATUS OF THE BUILD",
    headline: "The rules are live in the portal; several screens still await preview approval",
    note: "As of portal main 921d984 and website main 11d7cd1. Server alerts start once the alerts migration is applied. This slide is updated each time a change is merged.",
    sources: [LOG],
  });
  S.layouts.comparison(s, {
    frame: f,
    criteria: ["Paperwork", "PO standing", "Roles", "Notices"],
    a: { tag: "LIVE", heading: "Merged to main", rows: ["Two-stage packets, charging lookup, Resources", "PO-STD-2, PO-SCORE-2, Show Calculation, My Training", "Role tabs; Help Desk workflows; manual PDFs", "Server NRT and Week 15 alerts in the portal"] },
    b: { tag: "NEXT", heading: "Approved, preview pending", rows: ["Real form exporter; Shifts & Runs redesign", "PO status label and phase tracker on My Training", "Added UA's; Vercel role cards", "Alert email by mail relay; cease-training"] },
  });
}

// ---------------------------------------------------------------- 23 Closing
S.layouts.closing(deck.addSlide(), {
  kicker: "ACTION PLAN",
  headline: "Teach the three status rules and the five habits before the next class starts",
  steps: [
    { text: "Review this deck with the Coordinators", owner: "FTO Sergeant", due: "Next class" },
    { text: "Run the four-pass session with FTO's", owner: "FTO Coordinators", due: "In-service" },
    { text: "Update this deck after each merge", owner: "Portal owner", due: "Every merge" },
  ],
  contact: VERSION,
});

await deck.writeFile({ fileName: join(HERE, "FTO-Portal-Training-Deck.pptx") });
console.log(JSON.stringify({ warnings: S.warnings, diagnostics: S.diagnostics }, null, 1));
