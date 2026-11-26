import { caseSafe } from "@/components/bits";
import { cn } from "@/lib/utils";
import { CURRENT_PHASE, PHASE_LABEL, PHASE_WEEKS, PROGRESS, pct, STATUS_RULE, weekBand, type PhaseStats, type ProgressPO, type Status, type Week } from "@/features/rebuild/lib/po-progress/data";

export function weekClass(x: Week) {
  if (x.kind === "future") return "wk fut";
  if (x.kind === "limbo") return "wk lim";
  const b = weekBand(x);
  if (b.level === 2 && b.reason !== "20+ UA's") return "wk nrt";
  return `wk u${x.UA === 0 ? 0 : x.UA <= 9 ? 1 : x.UA <= 19 ? 2 : 3}${x.lim > 0 ? " haslim" : ""}`;
}

export function weekTitle(x: Week) {
  if (x.kind === "future") return `Week ${x.w} · not yet worked`;
  if (x.kind === "limbo") return `Week ${x.w} · limbo`;
  const b = weekBand(x);
  return `Week ${x.w} · ${x.UA} ${x.UA === 1 ? "UA" : "UA’s"}${x.lim ? ` · limbo days ${x.lim}` : ""}${x.nrt ? " · NRT" : ""}${!x.nrt && b.topCatUA >= 3 ? ` · ${b.topCatUA} UA’s in one category` : ""}${x.late ? " · late packet" : ""}`;
}

export function WeekCell({ x, showNum }: { x: Week; showNum?: boolean }) {
  return (
    <span className={weekClass(x)} title={weekTitle(x)}>
      {x.kind === "limbo" ? "L" : showNum && x.kind === "rated" ? x.UA : ""}
    </span>
  );
}

export function WeekStrip({ po, big }: { po: ProgressPO; big?: boolean }) {
  return (
    <div className={cn("strip", big && "big")}>
      {[1, 2, 3, 4].map((ph) => (
        <div key={ph} className="sph" style={{ "--n": PHASE_WEEKS[ph].length } as React.CSSProperties}>
          <div className="sphl">{PHASE_LABEL[ph - 1]}</div>
          <div className="sphw">
            {PHASE_WEEKS[ph].map((w) => (
              <WeekCell key={w} x={po.weeks[w - 1]} showNum={big} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Worst rated week band in a phase (PO-STD-1); limbo and future weeks are not rated. */
export function phaseWorstWeek(po: ProgressPO, phaseIndex: number): { level: 0 | 1 | 2; week: number; reason: string } | null {
  let worst: { level: 0 | 1 | 2; week: number; reason: string } | null = null;
  for (const x of po.weeks) {
    if (x.kind !== "rated" || x.ph !== phaseIndex + 1) continue;
    const b = weekBand(x);
    if (!worst || b.level > worst.level) worst = { level: b.level, week: x.w, reason: b.reason };
  }
  return worst;
}

function tileClass(s: PhaseStats | null, worst: ReturnType<typeof phaseWorstWeek>) {
  if (!s || !worst) return "tile fut";
  if (s.nrt > 0) return "tile nrt";
  return `tile ${worst.level === 2 ? "t3" : worst.level === 1 ? "t1" : "t0"}`;
}

function tileTitle(i: number, s: PhaseStats | null, worst: ReturnType<typeof phaseWorstWeek>) {
  if (!s || !worst) return `Phase ${PHASE_LABEL[i]} · not yet rated`;
  const band = (["MEETS STANDARD", "EMERGING CONCERN", "BELOW STANDARD"] as const)[worst.level];
  return `Phase ${PHASE_LABEL[i]} · worst rated week: Week ${worst.week} · ${band} (${worst.reason}) · ${s.UA} ${s.UA === 1 ? "UA" : "UA’s"} in phase`;
}

export function PhaseTiles({ po }: { po: ProgressPO }) {
  return (
    <div className="tiles">
      {po.phases.map((s, i) => {
        const worst = s ? phaseWorstWeek(po, i) : null;
        return (
          <div key={i} className={tileClass(s, worst)} title={tileTitle(i, s, worst)} data-band={worst?.level ?? ""}>
            <span>{PHASE_LABEL[i]}</span>
            <b>{s ? s.UA : "–"}</b>
            <i>{s ? pct(s.aPct) : ""}</i>
          </div>
        );
      })}
    </div>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={cn("chip", status === "BELOW STANDARD" ? "c-red" : status === "EMERGING CONCERN" ? "c-yel" : "c-grn")} title={STATUS_RULE[status]}>
      {status}
    </span>
  );
}

export function PreviouslyFlaggedChip({ week }: { week: number | null }) {
  if (week == null) return null;
  return (
    <span className="chip c-gry" title={`Flag cleared in Week ${week} after 2 rated weeks that met standard.`}>
      Previously Flagged <em>wk {week}</em>
    </span>
  );
}

export function VsClassChip({ po }: { po: ProgressPO }) {
  return (
    <span className={cn("chip", po.above ? "c-redo" : "c-grno")} title="UA % this phase vs class">
      {pct(po.phases[CURRENT_PHASE - 1]?.uaPct)} <em>vs</em> {pct(PROGRESS.classPhase[CURRENT_PHASE - 1]?.uaPct)}
    </span>
  );
}

export function trendDir(po: ProgressPO) {
  return po.trend > 0.002 ? 1 : po.trend < -0.002 ? -1 : 0;
}

export function TrendLabel({ po }: { po: ProgressPO }) {
  const d = trendDir(po);
  const prev = PHASE_LABEL[CURRENT_PHASE - 2];
  return (
    <span className={cn("text-[11px] font-bold", d > 0 ? "text-err" : d < 0 ? "text-ok" : "text-muted-foreground")}>
      {d > 0 ? `Worse than Phase ${prev}` : d < 0 ? `Better than Phase ${prev}` : `Same as Phase ${prev}`}
    </span>
  );
}

export function Legend() {
  const items: [string, string][] = [
    ["lw u0", "0 UA’s"],
    ["lw u1", "1-9"],
    ["lw u2", "10-19"],
    ["lw u3", "20+"],
    ["lw nrt", "NRT or 3+ in One Category"],
    ["lw lim", "Limbo week"],
    ["lw u0 haslim", "Week with limbo days"],
    ["lw fut", "Not yet worked"],
  ];
  return (
    <div className="legend">
      {items.map(([c, l]) => (
        <span key={l}>
          <i className={c} />
          {caseSafe(l)}
        </span>
      ))}
    </div>
  );
}
