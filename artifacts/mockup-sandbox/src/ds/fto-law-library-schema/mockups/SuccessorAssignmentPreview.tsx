import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  History,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type View = "edit" | "confirmation" | "history";

const initialAssignment = {
  successor: "FTO Marcus Reed",
  starts: "2025-06-17",
  ends: "2025-07-14",
};

export function SuccessorAssignmentPreview() {
  const [view, setView] = useState<View>("edit");
  const [assignment, setAssignment] = useState(initialAssignment);
  const [confirmed, setConfirmed] = useState(false);

  const updateAssignment = (field: keyof typeof initialAssignment, value: string) => {
    setConfirmed(false);
    setAssignment((current) => ({ ...current, [field]: value }));
  };

  const confirmPreview = () => {
    setConfirmed(true);
    setView("confirmation");
  };
  const displayDate = (date: string) =>
    date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not set";

  const navItems: { id: View; label: string; icon: typeof UserRound }[] = [
    { id: "edit", label: "Assignment", icon: UserRound },
    { id: "confirmation", label: "Confirmation", icon: CheckCircle2 },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <main className="fls-scope min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card uppercase">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-card-foreground">Columbus FTO Portal</p>
              <p className="text-xs text-muted-foreground">Coordinator workspace</p>
            </div>
          </div>
          <span className="hidden rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            Fictional workflow preview
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-primary">Coordinator tools <span aria-hidden="true" className="px-1 text-muted-foreground">/</span> Assignment transition</p>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 style={{ fontFamily: "var(--app-font-heading)" }} className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Successor assignment
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Preview a Phase 2 successor assignment while keeping daily packets attached to their original authors.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-chart-2" />
              Preview only · no roster changes
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4" aria-label="Workflow views">
          {navItems.map(({ id, label, icon: Icon }, index) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={active ? "step" : undefined}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{label}</span>
                <span className={`ml-1 text-xs ${active ? "text-primary-foreground" : "text-muted-foreground"}`}>
                  0{index + 1}
                </span>
              </button>
            );
          })}
        </div>

        {view === "edit" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
            <section className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Officer in training</p>
                    <h2 style={{ fontFamily: "var(--app-font-heading)" }} className="mt-1 text-xl font-bold text-card-foreground">PO Avery Bennett</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Columbus Division · Recruit 24-071</p>
                  </div>
                  <span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">Active</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoCell label="Current phase" value="Phase 1" />
                  <InfoCell label="Current FTO" value="FTO Dana Cole" />
                  <InfoCell label="Phase 1 ends" value="June 16, 2025" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Successor assignment</p>
                    <h2 style={{ fontFamily: "var(--app-font-heading)" }} className="mt-1 text-lg font-bold text-card-foreground">Schedule the next phase</h2>
                  <p className="mt-1 text-sm text-muted-foreground">The incoming assignment begins after the current assignment ends.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-card-foreground">Successor FTO</span>
                    <select
                      value={assignment.successor}
                      onChange={(event) => updateAssignment("successor", event.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option>FTO Marcus Reed</option>
                      <option>FTO Elena Price</option>
                      <option>FTO Samuel Ortiz</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-card-foreground">Phase scope</span>
                    <div className="rounded-md border border-input bg-muted px-3 py-2.5 text-sm font-medium text-card-foreground">
                      Phase 2
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-card-foreground">Assignment begins</span>
                    <span className="relative block">
                      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={assignment.starts}
                        onChange={(event) => updateAssignment("starts", event.target.value)}
                        className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-card-foreground">Planned phase end</span>
                    <span className="relative block">
                      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={assignment.ends}
                        onChange={(event) => updateAssignment("ends", event.target.value)}
                        className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </span>
                  </label>
                </div>
                <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-5 text-muted-foreground">
                  Changing assignment scope does not record phase approval.
                </p>
                <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                  <p className="text-xs text-muted-foreground">This preview does not change a live assignment.</p>
                  <button
                    type="button"
                    onClick={() => setView("confirmation")}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold uppercase text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Review transition <ArrowRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-lg border border-chart-3/30 bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Clock3 aria-hidden="true" className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-card-foreground">Late daily packet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Outstanding · not submitted</p>
                  </div>
                </div>
                <div className="my-4 rounded-md border border-border bg-muted p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                    Daily observation packet
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <DetailRow label="Shift date" value="June 13, 2025" />
                    <DetailRow label="Authored by" value="FTO Dana Cole" />
                    <DetailRow label="Status" value="Draft · 2 days late" />
                  </dl>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  This draft stays with its original FTO and shift date. Reassigning the next phase does not submit, approve, or transfer the packet.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Info aria-hidden="true" className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">Before you continue</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
                  <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Historical packet authorship remains unchanged.</li>
                  <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />The successor starts June 17, after Phase 1.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}

        {view === "confirmation" && (
          <section className="mx-auto max-w-3xl">
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-5 sm:px-7">
                <div className="flex items-start gap-4">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${confirmed ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                    {confirmed ? <CheckCircle2 aria-hidden="true" className="size-6" /> : <FileClock aria-hidden="true" className="size-6" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transition review</p>
                    <h2 style={{ fontFamily: "var(--app-font-heading)" }} className="mt-1 text-xl font-bold text-card-foreground">
                      {confirmed ? "Preview confirmation recorded" : "Confirm successor assignment"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {confirmed ? "This confirmation is local to this fictional preview." : "Review the transition details before confirming this preview."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCell label="Officer in training" value="PO Avery Bennett" />
                  <InfoCell label="Recruit number" value="24-071" />
                  <InfoCell label="Previous assignment" value="FTO Dana Cole · Phase 1" />
                  <InfoCell label="Successor assignment" value={`${assignment.successor} · Phase 2 scope`} />
                  <InfoCell label="Effective date" value={displayDate(assignment.starts)} />
                  <InfoCell label="Planned phase end" value={displayDate(assignment.ends)} />
                </div>

                <div className="rounded-md border border-border bg-muted p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <FileText aria-hidden="true" className="size-4" />
                    Outstanding packet remains unchanged
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    June 13, 2025 daily packet · authored by FTO Dana Cole · still a late, unsubmitted draft. This assignment transition neither submits nor approves it.
                  </p>
                </div>

                <p className="text-sm leading-5 text-muted-foreground">
                  Assignment scope is not a phase approval.
                </p>

                <div className="rounded-md border border-primary/30 bg-secondary/50 p-4">
                  <p className="text-sm font-semibold text-secondary-foreground">Fictional preview only</p>
                  <p className="mt-1 text-sm leading-6 text-secondary-foreground">
                    Confirming here records a sample transition for this screen only. No real roster or packet has been changed.
                  </p>
                </div>

                <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setView("edit")}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold uppercase text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" /> Back to assignment
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {confirmed && (
                      <button
                        type="button"
                        onClick={() => setView("history")}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold uppercase text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        View history <History aria-hidden="true" className="size-4" />
                      </button>
                    )}
                    {!confirmed && (
                      <button
                        type="button"
                        onClick={confirmPreview}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold uppercase text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Confirm preview <Check aria-hidden="true" className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="mx-auto max-w-3xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auditable record</p>
                    <h2 style={{ fontFamily: "var(--app-font-heading)" }} className="mt-1 text-xl font-bold text-foreground">Assignment transition history</h2>
              </div>
              <button
                type="button"
                onClick={() => setView("confirmation")}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium uppercase text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Review
              </button>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                <div>
                  <p style={{ fontFamily: "var(--app-font-heading)" }} className="text-lg font-bold text-card-foreground">PO Avery Bennett</p>
                  <p className="mt-1 text-sm text-muted-foreground">Recruit 24-071 · Columbus Division</p>
                </div>
                <span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                  {confirmed ? "Preview confirmed" : "Draft preview"}
                </span>
              </div>
              <ol className="relative space-y-0">
                <HistoryEvent
                  icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
                  title={confirmed ? "Successor assignment preview confirmed" : "Successor assignment prepared"}
                  date={confirmed ? "June 16, 2025 · 2:42 PM" : "June 16, 2025 · 2:38 PM"}
                  actor="Columbus FTO Coordinator"
                  description={`Phase 1 assignment with FTO Dana Cole ends June 16, 2025. Phase 2 scope with ${assignment.successor} is scheduled to begin ${displayDate(assignment.starts)}.`}
                  last={false}
                />
                <HistoryEvent
                  icon={<FileText aria-hidden="true" className="size-4" />}
                  title="Outstanding daily packet retained"
                  date="June 16, 2025 · 2:38 PM"
                  actor="Record continuity"
                  description="June 13 daily packet remains an unsubmitted draft authored by FTO Dana Cole. No submission or approval was recorded."
                  last
                />
              </ol>
              <div className="mt-3 rounded-md border border-border bg-muted p-4">
                <p className="text-sm font-semibold text-card-foreground">History scope</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Assignment scope does not record phase approval. These fictional entries illustrate a coordinator audit trail and are stored only in this preview.
                </p>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setView("edit")}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold uppercase text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" /> Back to assignment
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/60 px-3 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-card-foreground">{value}</dd>
    </div>
  );
}

function HistoryEvent({
  icon,
  title,
  date,
  actor,
  description,
  last,
}: {
  icon: ReactNode;
  title: string;
  date: string;
  actor: string;
  description: string;
  last: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6">
      {!last && <span aria-hidden="true" className="absolute left-4 top-9 h-full w-px bg-border" />}
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
          <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
          <time className="text-xs text-muted-foreground">{date}</time>
        </div>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{actor}</p>
        <p className="mt-2 text-sm leading-6 text-card-foreground">{description}</p>
      </div>
    </li>
  );
}
