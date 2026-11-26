import { useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  ClipboardList,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type Tab = "overview" | "classes" | "participants" | "assignments" | "records" | "audit";
type Status = "Active" | "Deactivated";

type SyntheticClass = { id: string; name: string; phase: string; starts: string; status: Status };
type Participant = { id: string; name: string; role: "PO" | "FTO" | "Coordinator"; badge: string; classId: string; status: Status };
type Assignment = { id: string; po: string; fto: string; phase: string; starts: string; ends: string; status: Status };
type TrainingRecord = { id: string; po: string; date: string; ref: string; runs: number; state: "Draft" | "Submitted" | "Reviewed"; version: number };
type AuditEvent = { at: string; actor: string; action: string; target: string };

const initialClasses: SyntheticClass[] = [
  { id: "SC-01", name: "Synthetic Class 151", phase: "Phase 1", starts: "2026-11-02", status: "Active" },
  { id: "SC-02", name: "Synthetic Class 152", phase: "Phase 2", starts: "2026-09-14", status: "Active" },
  { id: "SC-03", name: "Synthetic Class 149", phase: "Phase 3", starts: "2026-06-01", status: "Deactivated" },
];

const initialParticipants: Participant[] = [
  { id: "P-101", name: "PO Jordan Vale", role: "PO", badge: "T-4101", classId: "SC-01", status: "Active" },
  { id: "P-102", name: "PO Riley Ames", role: "PO", badge: "T-4102", classId: "SC-01", status: "Active" },
  { id: "P-103", name: "PO Casey Lund", role: "PO", badge: "T-4103", classId: "SC-02", status: "Active" },
  { id: "P-201", name: "FTO Morgan Hale", role: "FTO", badge: "T-2201", classId: "SC-01", status: "Active" },
  { id: "P-202", name: "FTO Drew Calder", role: "FTO", badge: "T-2202", classId: "SC-02", status: "Active" },
  { id: "P-301", name: "Coordinator Sam Ortega", role: "Coordinator", badge: "T-3301", classId: "SC-01", status: "Active" },
];

const initialAssignments: Assignment[] = [
  { id: "A-01", po: "PO Jordan Vale", fto: "FTO Morgan Hale", phase: "Phase 1", starts: "2026-11-02", ends: "2026-11-29", status: "Active" },
  { id: "A-02", po: "PO Riley Ames", fto: "FTO Morgan Hale", phase: "Phase 1", starts: "2026-11-02", ends: "2026-11-29", status: "Active" },
  { id: "A-03", po: "PO Casey Lund", fto: "FTO Drew Calder", phase: "Phase 2", starts: "2026-10-12", ends: "2026-11-08", status: "Deactivated" },
];

const initialRecords: TrainingRecord[] = [
  { id: "R-5001", po: "PO Jordan Vale", date: "2026-11-24", ref: "W4D2", runs: 6, state: "Submitted", version: 3 },
  { id: "R-5002", po: "PO Jordan Vale", date: "2026-11-25", ref: "W4D3", runs: 4, state: "Draft", version: 1 },
  { id: "R-5003", po: "PO Riley Ames", date: "2026-11-25", ref: "W4D3", runs: 5, state: "Reviewed", version: 2 },
  { id: "R-5004", po: "PO Casey Lund", date: "2026-11-06", ref: "W4D5", runs: 7, state: "Reviewed", version: 4 },
];

const initialAudit: AuditEvent[] = [
  { at: "2026-11-26 09:42", actor: "Test Admin", action: "Updated record", target: "R-5001 · v3" },
  { at: "2026-11-26 09:15", actor: "Test Admin", action: "Deactivated assignment", target: "A-03" },
  { at: "2026-11-25 16:08", actor: "Test Admin", action: "Created record", target: "R-5002 · v1" },
  { at: "2026-11-25 14:30", actor: "Test Admin", action: "Added participant", target: "P-103" },
  { at: "2026-11-24 08:02", actor: "Test Admin", action: "Created class", target: "SC-01" },
];

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "Classes", icon: ClipboardList },
  { id: "participants", label: "Participants", icon: Users },
  { id: "assignments", label: "Assignments", icon: Link2 },
  { id: "records", label: "Training records", icon: FileText },
  { id: "audit", label: "Audit history", icon: History },
];

const heading = { fontFamily: "var(--app-font-heading)" };

export function TestAdminPortalPreview() {
  const [tab, setTab] = useState<Tab>("overview");
  const [classes, setClasses] = useState(initialClasses);
  const [participants, setParticipants] = useState(initialParticipants);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [records, setRecords] = useState(initialRecords);
  const [audit, setAudit] = useState(initialAudit);
  const [query, setQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);

  const log = (action: string, target: string) =>
    setAudit((a) => [{ at: "2026-11-26 10:05", actor: "Test Admin", action, target }, ...a]);

  const deactivateClass = (id: string) => {
    setClasses((c) => c.map((x) => (x.id === id ? { ...x, status: "Deactivated" } : x)));
    log("Deactivated class", id);
  };
  const deactivateParticipant = (id: string) => {
    setParticipants((p) => p.map((x) => (x.id === id ? { ...x, status: "Deactivated" } : x)));
    log("Deactivated participant", id);
  };
  const deactivateAssignment = (id: string) => {
    setAssignments((a) => a.map((x) => (x.id === id ? { ...x, status: "Deactivated" } : x)));
    log("Deactivated assignment", id);
  };
  const addClass = () => {
    const id = `SC-0${classes.length + 1}`;
    setClasses((c) => [{ id, name: `Synthetic Class ${150 + classes.length + 3}`, phase: "Phase 1", starts: "2026-12-07", status: "Active" }, ...c]);
    log("Created class", id);
  };
  const saveRecord = (r: TrainingRecord) => {
    const next = { ...r, version: r.version + 1 };
    setRecords((rs) => rs.map((x) => (x.id === r.id ? next : x)));
    log("Updated record", `${r.id} · v${next.version}`);
    setSelectedRecord(null);
  };

  const filteredRecords = useMemo(
    () => records.filter((r) => `${r.id} ${r.po} ${r.ref}`.toLowerCase().includes(query.toLowerCase())),
    [records, query],
  );

  return (
    <main className="fls-scope min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card uppercase">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Columbus FTO Portal</p>
              <p className="text-xs text-muted-foreground">Test Admin · Synthetic staging</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-chart-2" /> Synthetic data
            </span>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4" /> Test Admin
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Test Admin sections" className="flex flex-col gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
          {tab === "overview" && (
            <Panel title="Overview">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Active classes" value={classes.filter((c) => c.status === "Active").length} />
                <Stat label="Active participants" value={participants.filter((p) => p.status === "Active").length} />
                <Stat label="Active assignments" value={assignments.filter((a) => a.status === "Active").length} />
                <Stat label="Training records" value={records.length} />
              </div>
              <h3 style={heading} className="mt-6 mb-3 text-sm font-bold uppercase text-card-foreground">Recent activity</h3>
              <AuditList events={audit.slice(0, 4)} />
            </Panel>
          )}

          {tab === "classes" && (
            <Panel title="Classes" action={<PrimaryButton onClick={addClass}><Plus className="size-4" aria-hidden="true" /> New class</PrimaryButton>}>
              <Table head={["Class", "Phase", "Starts", "Status", ""]}>
                {classes.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.id}</span></Td>
                    <Td>{c.phase}</Td>
                    <Td>{c.starts}</Td>
                    <Td><StatusPill status={c.status} /></Td>
                    <Td><DeactivateButton disabled={c.status !== "Active"} onClick={() => deactivateClass(c.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === "participants" && (
            <Panel title="Participants">
              <Table head={["Name", "Role", "Badge", "Class", "Status", ""]}>
                {participants.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <Td><span className="font-medium">{p.name}</span></Td>
                    <Td>{p.role}</Td>
                    <Td className="font-mono">{p.badge}</Td>
                    <Td>{p.classId}</Td>
                    <Td><StatusPill status={p.status} /></Td>
                    <Td><DeactivateButton disabled={p.status !== "Active"} onClick={() => deactivateParticipant(p.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === "assignments" && (
            <Panel title="Assignments">
              <Table head={["PO", "FTO", "Phase", "Dates", "Status", ""]}>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <Td><span className="font-medium">{a.po}</span></Td>
                    <Td>{a.fto}</Td>
                    <Td>{a.phase}</Td>
                    <Td>{a.starts} – {a.ends}</Td>
                    <Td><StatusPill status={a.status} /></Td>
                    <Td><DeactivateButton disabled={a.status !== "Active"} onClick={() => deactivateAssignment(a.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === "records" && (
            <Panel
              title="Training records"
              action={
                <label className="relative block w-64">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search record, PO, reference"
                    aria-label="Search training records"
                    className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              }
            >
              <Table head={["Record", "PO", "Date", "Ref", "Runs", "State", "Version"]}>
                {filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className="cursor-pointer border-t border-border hover:bg-accent"
                  >
                    <Td className="font-mono">{r.id}</Td>
                    <Td>{r.po}</Td>
                    <Td>{r.date}</Td>
                    <Td className="font-mono">{r.ref}</Td>
                    <Td>{r.runs}</Td>
                    <Td><span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">{r.state}</span></Td>
                    <Td>v{r.version}</Td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}

          {tab === "audit" && (
            <Panel title="Audit history">
              <AuditList events={audit} />
            </Panel>
          )}
        </section>
      </div>

      {selectedRecord && (
        <RecordEditor record={selectedRecord} onClose={() => setSelectedRecord(null)} onSave={saveRecord} />
      )}
    </main>
  );
}

function RecordEditor({ record, onClose, onSave }: { record: TrainingRecord; onClose: () => void; onSave: (r: TrainingRecord) => void }) {
  const [draft, setDraft] = useState(record);
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-foreground/30" role="dialog" aria-modal="true" aria-label={`Edit ${record.id}`}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Training record · v{record.version}</p>
            <h2 style={heading} className="text-lg font-bold text-card-foreground">{record.id}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted-foreground hover:bg-accent">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Field label="Probationary officer"><input value={draft.po} readOnly className={inputClass + " bg-muted"} /></Field>
          <Field label="Date"><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inputClass} /></Field>
          <Field label="Training-folder reference"><input value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} className={inputClass + " font-mono"} /></Field>
          <Field label="Runs"><input type="number" min={0} value={draft.runs} onChange={(e) => setDraft({ ...draft, runs: Number(e.target.value) })} className={inputClass} /></Field>
          <Field label="State">
            <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value as TrainingRecord["state"] })} className={inputClass}>
              <option>Draft</option>
              <option>Submitted</option>
              <option>Reviewed</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4 uppercase">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium uppercase text-foreground hover:bg-accent">Cancel</button>
          <PrimaryButton onClick={() => onSave(draft)}>Save new version</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 style={heading} className="text-xl font-bold uppercase text-card-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p style={heading} className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-foreground ${className}`}>{children}</td>;
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status === "Active" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function DeactivateButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium uppercase text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Ban className="size-3.5" aria-hidden="true" /> Deactivate
    </button>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-card-foreground">{label}</span>
      {children}
    </label>
  );
}

function AuditList({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="divide-y divide-border rounded-md border border-border">
      {events.map((e, i) => (
        <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{e.action}</p>
            <p className="text-xs text-muted-foreground">{e.actor}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-foreground">{e.target}</p>
            <p className="text-xs text-muted-foreground">{e.at}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
