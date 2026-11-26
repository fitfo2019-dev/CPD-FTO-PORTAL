import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowLeft, Ban, BookOpen, ClipboardList, FlaskConical, History,
  LayoutDashboard, Plus, Search, ShieldCheck, Users,
} from "lucide-react";
import {
  deactivate, loadAudit, loadRecords, loadScenario, createRecord, saveAssignment,
  saveClass, saveParticipant, testAdminError, updateRecord,
  type AuditEvent, type Scenario, type ScenarioKind, type TrainingRecord,
} from "./api.js";
import type {
  TestAdminAssignment, TestAdminAssignmentInput, TestAdminClass, TestAdminClassInput,
  TestAdminParticipant, TestAdminParticipantInput, TestAdminParticipantInputRole,
} from "@workspace/api-zod";
import "./test-admin.css";

type Section = "overview" | ScenarioKind | "records" | "audit";
type Notice = { kind: "error" | "success"; text: string } | null;
type ScenarioItem = TestAdminParticipant | TestAdminClass | TestAdminAssignment;
type Editor =
  | { kind: "participants"; item: TestAdminParticipant | null }
  | { kind: "classes"; item: TestAdminClass | null }
  | { kind: "assignments"; item: TestAdminAssignment | null };

const SECTIONS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "Classes", icon: ClipboardList },
  { id: "participants", label: "Participants", icon: Users },
  { id: "assignments", label: "Assignments", icon: Activity },
  { id: "records", label: "Training records", icon: BookOpen },
  { id: "audit", label: "Audit history", icon: History },
];
const ROLE_LABELS: Record<TestAdminParticipantInputRole, string> = {
  PO: "PO",
  FTO: "FTO",
  FTO_COORDINATOR: "Coordinator",
};

export default function TestAdminPage() {
  const [section, setSection] = useState<Section>("overview");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [recordCreateOpen, setRecordCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async (initial = false): Promise<boolean> => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const [nextScenario, nextRecords, nextAudit] = await Promise.all([
        loadScenario(), loadRecords(), loadAudit(),
      ]);
      setScenario(nextScenario);
      setRecords(nextRecords);
      setAudit(nextAudit);
      setAccessDenied(false);
      return true;
    } catch (error) {
      const safeError = testAdminError(error);
      if (/access is not available/i.test(safeError.message)) setAccessDenied(true);
      setNotice({ kind: "error", text: safeError.message });
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(true); }, [refresh]);

  const participantById = useMemo(
    () => new Map((scenario?.participants ?? []).map(person => [person.id, person])),
    [scenario?.participants],
  );
  const classById = useMemo(
    () => new Map((scenario?.classes ?? []).map(item => [item.id, item])),
    [scenario?.classes],
  );
  const assignmentById = useMemo(
    () => new Map((scenario?.assignments ?? []).map(item => [item.id, item])),
    [scenario?.assignments],
  );
  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return records ?? [];
    return (records ?? []).filter(record => {
      const assignment = assignmentById.get(record.assignment_id);
      const po = assignment ? participantById.get(assignment.po_id) : undefined;
      return [record.id, record.record_date, record.narrative, po?.display_label, po?.badge_label]
        .some(value => value?.toLocaleLowerCase().includes(needle));
    });
  }, [assignmentById, participantById, query, records]);

  async function perform<T>(action: () => Promise<T>, success: string, close?: () => void) {
    setNotice(null);
    try {
      await action();
      close?.();
      const reloaded = await refresh();
      setNotice(reloaded
        ? { kind: "success", text: success }
        : { kind: "error", text: "The change was saved, but the latest data could not be reloaded. Use refresh to check it." });
    } catch (error) {
      setNotice({ kind: "error", text: testAdminError(error).message });
    }
  }

  const currentTitle = SECTIONS.find(item => item.id === section)?.label ?? "Overview";

  if (loading) {
    return <main className="ta-root"><div className="ta-loading" role="status">Loading synthetic staging…</div></main>;
  }
  if (accessDenied) {
    return (
      <main className="ta-root">
        <div className="ta-denied">
          <ShieldCheck aria-hidden="true" />
          <h1>Test Admin access unavailable</h1>
          <p>This account is not authorized for synthetic staging.</p>
          <a href={`${import.meta.env.BASE_URL}`} className="ta-button ta-button-secondary"><ArrowLeft aria-hidden="true" /> Return to portal</a>
        </div>
      </main>
    );
  }
  if (!scenario || !records || !audit) {
    return (
      <main className="ta-root">
        <div className="ta-denied">
          <FlaskConical aria-hidden="true" />
          <h1>Synthetic staging is unavailable</h1>
          <p>{notice?.text ?? "The service could not load the test workspace."}</p>
          <button type="button" className="ta-button ta-button-primary" onClick={() => void refresh(true)}>Try again</button>
        </div>
      </main>
    );
  }

  const activePeople = scenario.participants.filter(item => item.active);
  const activeClasses = scenario.classes.filter(item => item.active);
  const activeAssignments = scenario.assignments.filter(item => item.active);
  const openEditor = (kind: ScenarioKind, item: ScenarioItem | null) => {
    if (kind === "participants") setEditor({ kind, item: item as TestAdminParticipant | null });
    if (kind === "classes") setEditor({ kind, item: item as TestAdminClass | null });
    if (kind === "assignments") setEditor({ kind, item: item as TestAdminAssignment | null });
  };
  const safeDeactivate = (kind: ScenarioKind, item: ScenarioItem) => {
    if (!window.confirm("Deactivate this fictional item? It will remain in history and will not be deleted.")) return;
    void perform(() => deactivate(kind, item.id), "Item deactivated.");
  };

  return (
    <main className="ta-root">
      <aside className="ta-sidebar">
        <div className="ta-brand">
          <div className="ta-brand-mark"><FlaskConical aria-hidden="true" /></div>
          <div><strong>Columbus FTO Portal</strong><span>Test Admin · Synthetic staging</span></div>
        </div>
        <nav className="ta-nav" aria-label="Test Admin sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined}
              className={`ta-nav-link${section === id ? " is-active" : ""}`}>
              <Icon aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
        <div className="ta-sidebar-foot"><ShieldCheck aria-hidden="true" /> Synthetic workspace</div>
      </aside>

      <div className="ta-main">
        <header className="ta-topbar">
          <a href={`${import.meta.env.BASE_URL}`} className="ta-back-link"><ArrowLeft aria-hidden="true" /> Portal</a>
          <span className="ta-synthetic-badge"><span /> Synthetic data</span>
        </header>
        <section className="ta-content">
          <div className="ta-crumbs"><span>Test Admin</span><span aria-hidden="true">/</span><b>{currentTitle}</b></div>
          <div className="ta-heading">
            <div><p className="ta-eyebrow">Synthetic staging</p><h1>{currentTitle}</h1></div>
            <button className="ta-icon-button" type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh synthetic data">
              <Activity aria-hidden="true" className={refreshing ? "ta-spinning" : ""} />
            </button>
          </div>
          {notice && <div className={`ta-notice ta-notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
          {section === "overview" && <Overview scenario={scenario} records={records} audit={audit} setSection={setSection} />}
          {section === "classes" && (
            <Panel title="Classes" subtitle="Fictional training groups">
              <Toolbar action="New class" onAction={() => openEditor("classes", null)} />
              <ClassesTable classes={scenario.classes} participants={participantById} onEdit={item => openEditor("classes", item)} onDeactivate={item => safeDeactivate("classes", item)} />
            </Panel>
          )}
          {section === "participants" && (
            <Panel title="Participants" subtitle="Fictional people and training roles">
              <Toolbar action="New participant" onAction={() => openEditor("participants", null)} />
              <ParticipantsTable participants={scenario.participants} onEdit={item => openEditor("participants", item)} onDeactivate={item => safeDeactivate("participants", item)} />
            </Panel>
          )}
          {section === "assignments" && (
            <Panel title="Assignments" subtitle="Class, officer, FTO, phase and date windows">
              <Toolbar action="New assignment" onAction={() => openEditor("assignments", null)} disabled={!activePeople.some(p => p.role === "PO") || !activePeople.some(p => p.role === "FTO") || activeClasses.length === 0} />
              <AssignmentsTable assignments={scenario.assignments} participants={participantById} classes={classById} onEdit={item => openEditor("assignments", item)} onDeactivate={item => safeDeactivate("assignments", item)} />
            </Panel>
          )}
          {section === "records" && (
            <Panel title="Training records" subtitle="Synthetic records only">
              <div className="ta-toolbar">
                <label className="ta-search"><Search aria-hidden="true" /><span className="sr-only">Search training records</span>
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search records, names, badges" />
                </label>
                <button type="button" className="ta-button ta-button-primary" onClick={() => setRecordCreateOpen(true)} disabled={!activeAssignments.length}>
                  <Plus aria-hidden="true" /> New record
                </button>
              </div>
              <RecordsTable records={filteredRecords} assignments={assignmentById} participants={participantById} onSelect={setSelectedRecord} />
            </Panel>
          )}
          {section === "audit" && (
            <Panel title="Audit history" subtitle="Read-only history of synthetic actions">
              <AuditTable events={audit} />
            </Panel>
          )}
        </section>
      </div>

      {editor && <ScenarioEditor editor={editor} scenario={scenario} onClose={() => setEditor(null)}
        onSave={async input => {
          if (editor.kind === "participants") {
            const data = input as TestAdminParticipantInput;
            await perform(() => saveParticipant(editor.item?.id ?? null, data), editor.item ? "Participant updated." : "Participant created.", () => setEditor(null));
          } else if (editor.kind === "classes") {
            const data = input as TestAdminClassInput;
            await perform(() => saveClass(editor.item?.id ?? null, data), editor.item ? "Class updated." : "Class created.", () => setEditor(null));
          } else {
            const data = input as TestAdminAssignmentInput;
            await perform(() => saveAssignment(editor.item?.id ?? null, data), editor.item ? "Assignment updated." : "Assignment created.", () => setEditor(null));
          }
        }} />}
      {recordCreateOpen && <CreateRecordDialog assignments={activeAssignments} classes={classById} participants={participantById}
        onClose={() => setRecordCreateOpen(false)} onSave={input => perform(() => createRecord(input), "Training record created.", () => setRecordCreateOpen(false))} />}
      {selectedRecord && <RecordEditor record={selectedRecord} poName={(() => {
        const assignment = assignmentById.get(selectedRecord.assignment_id);
        return assignment ? participantById.get(assignment.po_id)?.display_label ?? "Fictional participant" : "Fictional participant";
      })()} onClose={() => setSelectedRecord(null)}
        onSave={input => perform(() => updateRecord(selectedRecord.id, { ...input, base_version: selectedRecord.version }), "A new record version was saved.", () => setSelectedRecord(null))} />}
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="ta-panel"><div className="ta-panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div>;
}

function Toolbar({ action, onAction, disabled = false }: { action: string; onAction: () => void; disabled?: boolean }) {
  return <div className="ta-toolbar"><span className="ta-count">Scenario setup</span><button className="ta-button ta-button-primary" type="button" onClick={onAction} disabled={disabled}><Plus aria-hidden="true" />{action}</button></div>;
}

function Overview({ scenario, records, audit, setSection }: {
  scenario: Scenario; records: TrainingRecord[]; audit: AuditEvent[]; setSection: (section: Section) => void;
}) {
  return (
    <div className="ta-overview">
      <div className="ta-stats">
        <Stat label="Active classes" value={scenario.classes.filter(item => item.active).length} />
        <Stat label="Active participants" value={scenario.participants.filter(item => item.active).length} />
        <Stat label="Active assignments" value={scenario.assignments.filter(item => item.active).length} />
        <Stat label="Training records" value={records.length} />
      </div>
      <Panel title="Recent activity" subtitle="Latest synthetic staging changes">
        {audit.length ? <AuditTable events={audit.slice(0, 5)} /> : <Empty text="No synthetic actions have been recorded yet." />}
      </Panel>
      <div className="ta-quick-links">
        {(["classes", "participants", "assignments", "records"] as const).map((id) => {
          const section = SECTIONS.find(item => item.id === id)!;
          const Icon = section.icon;
          return <button key={id} type="button" onClick={() => setSection(id)}><Icon aria-hidden="true" />{section.label}<span aria-hidden="true">→</span></button>;
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="ta-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function ClassesTable({ classes, participants, onEdit, onDeactivate }: {
  classes: TestAdminClass[]; participants: Map<string, TestAdminParticipant>;
  onEdit: (item: TestAdminClass) => void; onDeactivate: (item: TestAdminClass) => void;
}) {
  if (!classes.length) return <Empty text="No fictional classes yet. Create one to start a scenario." />;
  return <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Class</th><th>Coordinator</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {classes.map(item => <tr key={item.id}><td><strong>{item.label}</strong><small>{shortId(item.id)}</small></td><td>{participants.get(item.coordinator_id)?.display_label ?? "Unavailable"}</td><td><Status active={item.active} /></td><td><RowActions active={item.active} onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} /></td></tr>)}
  </tbody></table></div>;
}

function ParticipantsTable({ participants, onEdit, onDeactivate }: {
  participants: TestAdminParticipant[]; onEdit: (item: TestAdminParticipant) => void; onDeactivate: (item: TestAdminParticipant) => void;
}) {
  if (!participants.length) return <Empty text="No fictional participants yet. Add a PO, FTO or coordinator." />;
  return <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Name</th><th>Role</th><th>Badge</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {participants.map(item => <tr key={item.id}><td><strong>{item.display_label}</strong><small>{shortId(item.id)}</small></td><td>{ROLE_LABELS[item.role]}</td><td className="ta-mono">{item.badge_label}</td><td><Status active={item.active} /></td><td><RowActions active={item.active} onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} /></td></tr>)}
  </tbody></table></div>;
}

function AssignmentsTable({ assignments, participants, classes, onEdit, onDeactivate }: {
  assignments: TestAdminAssignment[]; participants: Map<string, TestAdminParticipant>; classes: Map<string, TestAdminClass>;
  onEdit: (item: TestAdminAssignment) => void; onDeactivate: (item: TestAdminAssignment) => void;
}) {
  if (!assignments.length) return <Empty text="No fictional assignments yet. Add participants and a class first." />;
  return <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Class</th><th>PO</th><th>FTO</th><th>Phase</th><th>Training dates</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {assignments.map(item => <tr key={item.id}><td>{classes.get(item.class_id)?.label ?? "Unavailable"}</td><td>{participants.get(item.po_id)?.display_label ?? "Unavailable"}</td><td>{participants.get(item.fto_id)?.display_label ?? "Unavailable"}</td><td>Phase {item.phase}</td><td>{item.starts_on} – {item.ends_on}</td><td><Status active={item.active} /></td><td><RowActions active={item.active} onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} /></td></tr>)}
  </tbody></table></div>;
}

function RecordsTable({ records, assignments, participants, onSelect }: {
  records: TrainingRecord[]; assignments: Map<string, TestAdminAssignment>; participants: Map<string, TestAdminParticipant>;
  onSelect: (record: TrainingRecord) => void;
}) {
  if (!records.length) return <Empty text="No synthetic training records match this search." />;
  return <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Record</th><th>PO</th><th>Date</th><th>Phase</th><th>Status</th><th>Version</th></tr></thead><tbody>
    {records.map(record => {
      const assignment = assignments.get(record.assignment_id);
      return <tr key={record.id} className="ta-click-row" onClick={() => onSelect(record)} tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(record); } }}>
        <td className="ta-mono">{shortId(record.id)}</td><td>{assignment ? participants.get(assignment.po_id)?.display_label ?? "Fictional participant" : "Fictional participant"}</td>
        <td>{record.record_date}</td><td>Phase {record.phase}</td><td><RecordStatus status={record.status} /></td><td>v{record.version}</td>
      </tr>;
    })}
  </tbody></table></div>;
}

function AuditTable({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <Empty text="No audit history has been recorded." />;
  return <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Time (UTC)</th><th>Action</th><th>Target</th><th>Version</th></tr></thead><tbody>
    {events.map(event => <tr key={event.id}><td className="ta-mono">{new Date(event.timestamp).toLocaleString()}</td><td>{humanize(event.action)}</td><td>{event.target_type ? `${event.target_type.toLocaleLowerCase()} · ${event.target_id ? shortId(event.target_id) : ""}` : event.record_id ? `Training record · ${shortId(event.record_id)}` : "Synthetic staging"}</td><td>{event.version ? `v${event.version}` : "—"}</td></tr>)}
  </tbody></table></div>;
}

function RowActions({ active, onEdit, onDeactivate }: { active: boolean; onEdit: () => void; onDeactivate: () => void }) {
  return <div className="ta-row-actions"><button type="button" className="ta-text-button" onClick={onEdit}>Edit</button><button type="button" className="ta-text-button ta-deactivate" onClick={onDeactivate} disabled={!active}><Ban aria-hidden="true" />Deactivate</button></div>;
}

function Status({ active }: { active: boolean }) {
  return <span className={`ta-status ${active ? "is-active" : "is-inactive"}`}>{active ? "Active" : "Deactivated"}</span>;
}
function RecordStatus({ status }: { status: string }) {
  return <span className="ta-status is-record">{status}</span>;
}
function Empty({ text }: { text: string }) { return <div className="ta-empty">{text}</div>; }

function ScenarioEditor({ editor, scenario, onClose, onSave }: {
  editor: Editor; scenario: Scenario; onClose: () => void; onSave: (input: TestAdminParticipantInput | TestAdminClassInput | TestAdminAssignmentInput) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(editor.kind === "participants" ? editor.item?.display_label ?? "" : editor.kind === "classes" ? editor.item?.label ?? "" : "");
  const [badge, setBadge] = useState(editor.kind === "participants" ? editor.item?.badge_label ?? "" : "");
  const [role, setRole] = useState<TestAdminParticipantInputRole>(editor.kind === "participants" ? editor.item?.role ?? "PO" : "PO");
  const [coordinatorId, setCoordinatorId] = useState(editor.kind === "classes" ? editor.item?.coordinator_id ?? "" : "");
  const [classId, setClassId] = useState(editor.kind === "assignments" ? editor.item?.class_id ?? "" : "");
  const [poId, setPoId] = useState(editor.kind === "assignments" ? editor.item?.po_id ?? "" : "");
  const [ftoId, setFtoId] = useState(editor.kind === "assignments" ? editor.item?.fto_id ?? "" : "");
  const [phase, setPhase] = useState(String(editor.kind === "assignments" ? editor.item?.phase ?? 1 : 1));
  const [startsOn, setStartsOn] = useState(editor.kind === "assignments" ? editor.item?.starts_on ?? "" : "");
  const [endsOn, setEndsOn] = useState(editor.kind === "assignments" ? editor.item?.ends_on ?? "" : "");
  const active = scenario.participants.filter(person => person.active);
  const coordinators = active.filter(person => person.role === "FTO_COORDINATOR");
  const pos = active.filter(person => person.role === "PO");
  const ftos = active.filter(person => person.role === "FTO");
  const classes = scenario.classes.filter(item => item.active);
  const editing = !!editor.item;
  const title = `${editing ? "Edit" : "New"} ${editor.kind === "participants" ? "participant" : editor.kind === "classes" ? "class" : "assignment"}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    let payload: TestAdminParticipantInput | TestAdminClassInput | TestAdminAssignmentInput;
    if (editor.kind === "participants") {
      if (!name.trim() || !badge.trim()) { setError("Enter a name and badge."); return; }
      payload = { display_label: name.trim(), badge_label: badge.trim(), role: editor.item?.role ?? role };
    } else if (editor.kind === "classes") {
      if (!name.trim() || !coordinatorId) { setError("Enter a class name and select an active coordinator."); return; }
      payload = { label: name.trim(), coordinator_id: coordinatorId };
    } else {
      if (!classId || !poId || !ftoId || !startsOn || !endsOn) { setError("Complete each assignment field."); return; }
      if (poId === ftoId) { setError("Choose different people for PO and FTO."); return; }
      if (endsOn < startsOn) { setError("The end date cannot be before the start date."); return; }
      payload = { class_id: classId, po_id: poId, fto_id: ftoId, phase: Number(phase), starts_on: startsOn, ends_on: endsOn };
    }
    setBusy(true);
    try { await onSave(payload); } finally { setBusy(false); }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form className="ta-form" onSubmit={submit}>
        {editor.kind === "participants" && <>
          <Field label="Display name"><input autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)} required /></Field>
          <Field label="Badge"><input maxLength={20} value={badge} onChange={event => setBadge(event.target.value)} required /></Field>
          <Field label="Role">{editing ? <input readOnly value={ROLE_LABELS[editor.item!.role]} /> : <select value={role} onChange={event => setRole(event.target.value as TestAdminParticipantInputRole)}><option value="PO">PO</option><option value="FTO">FTO</option><option value="FTO_COORDINATOR">Coordinator</option></select>}</Field>
        </>}
        {editor.kind === "classes" && <>
          <Field label="Class name"><input autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)} required /></Field>
          <Field label="Coordinator"><select value={coordinatorId} onChange={event => setCoordinatorId(event.target.value)} required><option value="">Select a coordinator</option>{coordinators.map(person => <option key={person.id} value={person.id}>{person.display_label} · {person.badge_label}</option>)}</select></Field>
        </>}
        {editor.kind === "assignments" && <>
          <Field label="Class"><select value={classId} onChange={event => setClassId(event.target.value)} required><option value="">Select a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Probationary officer"><select value={poId} onChange={event => setPoId(event.target.value)} required><option value="">Select a PO</option>{pos.map(person => <option key={person.id} value={person.id}>{person.display_label} · {person.badge_label}</option>)}</select></Field>
          <Field label="Field training officer"><select value={ftoId} onChange={event => setFtoId(event.target.value)} required><option value="">Select an FTO</option>{ftos.map(person => <option key={person.id} value={person.id}>{person.display_label} · {person.badge_label}</option>)}</select></Field>
          <Field label="Phase"><select value={phase} onChange={event => setPhase(event.target.value)}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>Phase {value}</option>)}</select></Field>
          <div className="ta-form-row"><Field label="Start date"><input type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} required /></Field><Field label="End date"><input type="date" value={endsOn} onChange={event => setEndsOn(event.target.value)} required /></Field></div>
        </>}
        {error && <p className="ta-form-error" role="alert">{error}</p>}
        <div className="ta-dialog-actions"><button type="button" className="ta-button ta-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="ta-button ta-button-primary" disabled={busy}>{editing ? "Save changes" : "Create"}</button></div>
      </form>
    </Dialog>
  );
}

function CreateRecordDialog({ assignments, classes, participants, onClose, onSave }: {
  assignments: TestAdminAssignment[]; classes: Map<string, TestAdminClass>; participants: Map<string, TestAdminParticipant>;
  onClose: () => void; onSave: (input: { assignment_id: string; record_date: string; narrative: string; status: "draft" | "submitted" }) => Promise<void>;
}) {
  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narrative, setNarrative] = useState("");
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const assignment = assignments.find(item => item.id === assignmentId);
    if (!assignment || !date || date < assignment.starts_on || date > assignment.ends_on) {
      setError("Choose an active assignment and a date within its training window."); return;
    }
    if (!narrative.trim()) { setError("Enter a synthetic training narrative."); return; }
    setBusy(true);
    try { await onSave({ assignment_id: assignmentId, record_date: date, narrative, status }); }
    finally { setBusy(false); }
  }
  return <Dialog title="New training record" onClose={onClose}><form className="ta-form" onSubmit={submit}>
    <Field label="Assignment"><select value={assignmentId} onChange={event => setAssignmentId(event.target.value)} required><option value="">Select an assignment</option>{assignments.map(item => <option key={item.id} value={item.id}>{classes.get(item.class_id)?.label ?? "Class"} · {participants.get(item.po_id)?.display_label ?? "PO"} · Phase {item.phase}</option>)}</select></Field>
    <Field label="Record date"><input type="date" value={date} onChange={event => setDate(event.target.value)} required /></Field>
    <Field label="Narrative"><textarea maxLength={4000} rows={6} value={narrative} onChange={event => setNarrative(event.target.value)} required /></Field>
    <Field label="Status"><select value={status} onChange={event => setStatus(event.target.value as "draft" | "submitted")}><option value="draft">Draft</option><option value="submitted">Submitted</option></select></Field>
    {error && <p className="ta-form-error" role="alert">{error}</p>}
    <div className="ta-dialog-actions"><button type="button" className="ta-button ta-button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="ta-button ta-button-primary" disabled={busy}>Create record</button></div>
  </form></Dialog>;
}

function RecordEditor({ record, poName, onClose, onSave }: {
  record: TrainingRecord; poName: string; onClose: () => void;
  onSave: (input: { narrative: string; status: "draft" | "submitted" }) => Promise<void>;
}) {
  const [narrative, setNarrative] = useState(record.narrative);
  const [status, setStatus] = useState<"draft" | "submitted">(record.status);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!narrative.trim()) { setError("Enter a training narrative."); return; }
    setBusy(true);
    try { await onSave({ narrative, status }); }
    finally { setBusy(false); }
  }
  return <Dialog title={`Training record · v${record.version}`} onClose={onClose}>
    <form className="ta-form" onSubmit={submit}>
      <Field label="Probationary officer"><input readOnly value={poName} /></Field>
      <Field label="Record date"><input readOnly value={record.record_date} /></Field>
      <Field label="Phase"><input readOnly value={`Phase ${record.phase}`} /></Field>
      <Field label="Narrative"><textarea maxLength={4000} rows={8} value={narrative} onChange={event => setNarrative(event.target.value)} required /></Field>
      <Field label="Status"><select value={status} onChange={event => setStatus(event.target.value as "draft" | "submitted")}><option value="draft">Draft</option><option value="submitted">Submitted</option></select></Field>
      {error && <p className="ta-form-error" role="alert">{error}</p>}
      <div className="ta-dialog-actions"><button type="button" className="ta-button ta-button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="ta-button ta-button-primary" disabled={busy}>Save new version</button></div>
    </form>
  </Dialog>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="ta-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ta-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header className="ta-dialog-head"><div><p>Fictional data</p><h2>{title}</h2></div><button type="button" className="ta-icon-button" onClick={onClose} aria-label="Close dialog">×</button></header>
      {children}
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ta-field"><span>{label}</span>{children}</label>;
}

function shortId(id: string) { return id.slice(0, 8).toLocaleUpperCase(); }
function humanize(action: string) { return action.toLocaleLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toLocaleUpperCase()); }
