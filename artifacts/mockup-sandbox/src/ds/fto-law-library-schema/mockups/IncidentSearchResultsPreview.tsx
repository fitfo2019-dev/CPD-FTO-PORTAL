import { useMemo, useState } from "react";
import { ArrowUpRight, FileText, Search, ShieldCheck, X } from "lucide-react";

const sampleReports = [
  {
    reportId: "sample-day-2026-11-19",
    runId: "sample-run-01",
    incidentNumber: "613402781",
    date: "11/19/2026",
    shift: "A-Co",
    phase: "Phase 3",
    recruit: "PO Avery Bennett",
    assignment: "21A-1",
    form: "Call for Service",
    formNumber: "U-10.181",
  },
  {
    reportId: "sample-day-2026-11-15",
    runId: "sample-run-04",
    incidentNumber: "613402781",
    date: "11/15/2026",
    shift: "A-Co",
    phase: "Phase 3",
    recruit: "PO Avery Bennett",
    assignment: "21A-1",
    form: "Domestic Incident",
    formNumber: "U-10.182",
  },
  {
    reportId: "sample-day-2026-11-11",
    runId: "sample-run-02",
    incidentNumber: "613409955",
    date: "11/11/2026",
    shift: "B-Co",
    phase: "Phase 3",
    recruit: "PO Avery Bennett",
    assignment: "41B-1",
    form: "Traffic Crash Investigation",
    formNumber: "U-10.183",
  },
];

export function IncidentSearchResultsPreview() {
  const [query, setQuery] = useState("613402781");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? sampleReports.filter(report =>
          report.incidentNumber.toLowerCase().includes(normalized),
        )
      : [];
  }, [query]);

  return (
    <main className="fls-scope min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card uppercase">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Columbus FTO Portal</p>
              <p className="text-xs text-muted-foreground">Saved shift records</p>
            </div>
          </div>
          <span className="hidden rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            Sample data
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-7">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Saved records <span className="px-1 text-muted-foreground">/</span> Incident lookup
          </p>
          <h1
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={{ fontFamily: "var(--app-font-heading)" }}
          >
            Search incidents across shifts
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Find the saved shift report for an incident number without opening each day.
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <label htmlFor="incident-search" className="block text-sm font-semibold text-card-foreground">
            Incident number
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="incident-search"
                type="search"
                inputMode="numeric"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Enter an incident number"
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-4" />
                Clear
              </button>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-card-foreground">Matching saved runs</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </span>
          </div>

          {matches.length ? (
            <ul className="divide-y divide-border" aria-live="polite">
              {matches.map((report, index) => (
                <li key={report.runId} className="py-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-card-foreground">
                          {report.incidentNumber}
                        </span>
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                          {report.form}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-card-foreground">
                        {report.date} <span className="text-muted-foreground">·</span> {report.shift}
                        <span className="text-muted-foreground"> · </span>{report.phase}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {report.recruit} <span aria-hidden="true">·</span> {report.assignment}
                        <span aria-hidden="true">·</span> Shift report {index + 1}
                      </p>
                    </div>
                    <a
                      href={`/reports/${report.reportId}#run-${report.runId}`}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <FileText aria-hidden="true" className="size-4" />
                      Open run
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {report.formNumber} <span aria-hidden="true">·</span> Daily log dated {report.date}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-border bg-muted/50 px-4 py-8 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Search aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-card-foreground">
                {query.trim() ? "No matching incidents" : "Enter an incident number"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {query.trim()
                  ? "Try another number to search your saved shift reports."
                  : "Matching saved runs will appear here."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
