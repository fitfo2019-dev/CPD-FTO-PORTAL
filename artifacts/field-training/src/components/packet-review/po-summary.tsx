import type { PacketPoTotals, PacketPoPeriodTotals } from "@workspace/api-client-react";
import { CATEGORY_LABEL, type Category } from "@/lib/model.js";

const RATING_CODES = ["NO", "A", "RT", "UA", "NRT"] as const;
const PERIODS = [
  ["Daily", "daily"],
  ["Weekly · Sunday–Saturday", "weekly"],
  ["Monthly · calendar month", "monthly"],
] as const satisfies readonly (readonly [string, keyof PacketPoTotals])[];

const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, {
    timeZone: "UTC", year: "numeric", month: "short", day: "numeric",
  });
}
function periodLabel(totals: PacketPoPeriodTotals) {
  return totals.start_date === totals.end_date
    ? displayDate(totals.start_date)
    : `${displayDate(totals.start_date)} – ${displayDate(totals.end_date)}`;
}

export function PoPacketSummary({ totals, testId = "po-packet-summary" }: {
  totals: PacketPoTotals;
  testId?: string;
}) {
  return <section className="space-y-4" data-testid={testId} aria-label="Your packet review summary">
    <div className="grid gap-3 lg:grid-cols-3">
      {PERIODS.map(([label, key]) => {
        const period = totals[key];
        return <article key={key} className="border border-border bg-card p-3" data-testid={`po-period-${key}`}>
          <header className="mb-3 border-b border-border pb-2">
            <h3 className="label-caps">{label}</h3>
            <p className="mono mt-1 text-xs text-muted-foreground">{periodLabel(period)}</p>
          </header>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="block text-xs text-muted-foreground">Logs</span><strong>{period.log_count}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Ratings reviewed</span><strong>{period.reviewed_log_count}</strong></div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">Rating counts</span>
            <div className="mt-1 grid grid-cols-5 gap-1" aria-label={`${label} rating counts`}>
              {RATING_CODES.map(code => <div key={code} className="bg-muted/60 px-1 py-1 text-center" data-testid={`po-rating-${key}-${code}`}>
                <span className="block text-[0.62rem] font-bold">{code}</span>
                <span className="mono text-xs">{period.rating_counts[code]}</span>
              </div>)}
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground">Reviewed run checklists</span>
            <strong className="float-right mono">{period.reviewed_run_checklists} / {period.total_runs}</strong>
          </div>
          <details className="mt-3 border-t border-border pt-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide">Activity count details</summary>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {Object.entries(period.activity).sort(([a], [b]) => a.localeCompare(b)).map(([keyName, count]) =>
                <div key={keyName} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{humanize(keyName)}</dt><dd className="mono m-0">{count}</dd>
                </div>)}
            </dl>
          </details>
        </article>;
      })}
    </div>
    <section className="border border-[hsl(var(--warn)/.35)] bg-[hsl(var(--warn)/.06)] p-3" data-testid="po-unacceptable-details">
      <h3 className="label-caps mb-2">Your unacceptable ratings</h3>
      {totals.unacceptable_details.length ? <ul className="divide-y divide-border">
        {totals.unacceptable_details.map((item, index) => <li key={`${item.record_date}-${item.category_key}-${index}`} className="py-2 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <strong>{displayDate(item.record_date)} · {CATEGORY_LABEL[item.category_key as Category] ?? humanize(item.category_key)}</strong>
            <span className="mono text-xs font-bold text-destructive" data-testid={item.limbo_day ? "po-ua-not-counted" : undefined}>{item.limbo_day ? `${item.rating} · Not counted: Limbo Day` : item.rating}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.justification || "No written justification was recorded."}</p>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">No reviewed unacceptable ratings are recorded in these periods.</p>}
    </section>
  </section>;
}
