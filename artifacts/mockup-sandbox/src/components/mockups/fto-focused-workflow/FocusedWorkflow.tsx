import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog.js";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Plus, Save, Search, ShieldCheck } from "lucide-react";
import { DutyForm, DUTY_GROUPS, makeDutyDraft, type DutyDraft } from "./_source.js";
import "./_group.css";
import "./_workflow.css";

type PrimaryKind = "call_for_service" | "self_initiated" | "domestic_incident" | "traffic_crash" | "traffic_stop" | "high_risk_stop" | "building_search";
type SupplementKey = "building_search" | "arrest_process" | "ovi_process" | "narrative_addition";
type RunDetails = {
  incident: string; unit: string; kind: PrimaryKind | ""; date: string; ingress: string; dispatched: string; cleared: string;
  code: string; situation: string; address: string; city: string; state: string; zip: string; zone: string;
  district: string; clearance: string; notes: string; checklist: Record<string, boolean>; reviewed: boolean;
};
type PacketStep = {
  id: string; title: string; page: number; kind: "duty" | "run" | "supplement"; runId?: string; supplement?: SupplementKey;
};
const PRIMARY_FORMS: { key: PrimaryKind; label: string }[] = [
  { key: "call_for_service", label: "Call for Service" }, { key: "self_initiated", label: "Self-Initiated Run / Training" },
  { key: "domestic_incident", label: "Domestic Incident" }, { key: "traffic_crash", label: "Traffic Crash Investigation" },
  { key: "traffic_stop", label: "Traffic Stop" }, { key: "high_risk_stop", label: "High Risk Traffic Stop" },
  { key: "building_search", label: "Building Search" },
];
const SUPPLEMENTS: { key: SupplementKey; label: string; checks: string[] }[] = [
  { key: "building_search", label: "Building Search", checks: ["Plan and coordinate the search", "Conduct a safe and systematic search", "Document the search and any property"] },
  { key: "arrest_process", label: "Arrest Process", checks: ["Complete required arrest processing steps", "Document transport and disposition", "Review related report information"] },
  { key: "ovi_process", label: "OVI Process", checks: ["Document applicable OVI processing steps", "Review required testing and paperwork", "Record disposition and related forms"] },
  { key: "narrative_addition", label: "Narrative Addition / Continuation", checks: ["Add continuation narrative", "Review narrative for clarity and completeness"] },
];
const SAMPLE_INCIDENT = "24012345";
const fieldClass = "fw-field";
const blankRun = (unit = ""): RunDetails => ({
  incident: "", unit, kind: "", date: "", ingress: "", dispatched: "", cleared: "", code: "", situation: "",
  address: "", city: "", state: "", zip: "", zone: "", district: "", clearance: "", notes: "", checklist: {}, reviewed: false,
});
const normalizeCode = (value: string) => value.trim().toUpperCase() === "N/A" ? "N/A" : value.toUpperCase().replace(/^10[\s-]+/, "").replace(/[^0-9A-Z]/g, "").slice(0, 5);
const suggestRunKind = (code: string): PrimaryKind | "" => code === "17" ? "domestic_incident" : code === "4" || code === "5" ? "traffic_crash" : "";
const codeHint = (code: string) => code === "17" ? "10-17 · Domestic Violence"
  : code === "27" ? "10-27 · Assault or Hospital Report"
    : code === "6" ? "10-6 · Traffic Violator/Complaint. Select Traffic Stop or High Risk Traffic Stop manually."
      : "";

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`fw-field-wrap${wide ? " fw-wide" : ""}`}><span className="label-caps">{label}</span>{children}</label>;
}

function RadioCodeField({ label, value, onChange, onSuggest, placeholder, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; onSuggest: (value: string) => void; placeholder: string; optional?: boolean;
}) {
  const normalized = normalizeCode(value);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSuggest(normalized);
    }
  };
  return <Field label={label}><input className={`${fieldClass} fw-mono`} value={value} placeholder={placeholder}
    onChange={(event) => onChange(normalizeCode(event.target.value))}
    onBlur={() => onSuggest(normalized)} onKeyDown={onKeyDown}
    aria-describedby={normalized ? `${label.replace(/\W+/g, "-").toLowerCase()}-hint` : undefined} />
    {normalized && <span className="fw-field-hint" id={`${label.replace(/\W+/g, "-").toLowerCase()}-hint`}>
      {codeHint(normalized) || (optional ? "Optional code entered for this preview." : "Choose a primary form manually when no unique suggestion applies.")}
    </span>}
  </Field>;
}

function ChecklistSample({ title, items, checked, onChange }: {
  title: string; items: string[]; checked: Record<string, boolean>; onChange: (next: Record<string, boolean>) => void;
}) {
  return <fieldset className="fw-checklist">
    <legend>{title}</legend>
    <p className="fw-helper">Sample checklist only. Review confirmation is at the end of this section.</p>
    {items.map((item, index) => <label className="fw-check-row" key={item}>
      <input type="checkbox" checked={checked[String(index)] !== false} onChange={(event) => onChange({ ...checked, [String(index)]: event.target.checked })} />
      <span>{item}</span>
    </label>)}
  </fieldset>;
}

function FocusedForm({ step, duty, onDuty, run, onRun, supplementChecks, setSupplementChecks, supplementNotes, setSupplementNote }: {
  step: PacketStep; duty: DutyDraft; onDuty: (next: DutyDraft) => void; run: RunDetails;
  onRun: (next: RunDetails) => void; supplementChecks: Record<string, boolean>; setSupplementChecks: (checks: Record<string, boolean>) => void;
  supplementNotes: string; setSupplementNote: (value: string) => void;
}) {
  if (step.kind === "duty") return <DutyForm value={duty} onChange={onDuty} />;
  if (step.kind === "run") {
    const patchRun = (patch: Partial<RunDetails>) => onRun({ ...run, ...patch, reviewed: false });
    const suggestKind = (code: string) => {
      if (code === "6") patchRun({ kind: "" });
      else {
        const suggestion = suggestRunKind(code);
        if (suggestion) patchRun({ kind: suggestion });
      }
    };
    const runNumber = step.runId?.replace("run-", "") || "";
    const kindLabel = PRIMARY_FORMS.find((form) => form.key === run.kind)?.label || "Select primary run type";
    return <section className="fw-form-card" aria-labelledby="run-form-title">
      <div className="fw-card-heading">
        <div><p className="label-caps">Page {step.page} · Phase I · Week 3 · Day 2</p><h2 id="run-form-title">Run {runNumber} · {kindLabel}</h2></div>
        <span className="fw-sample-tag">Sample Checklist · Not Complete Operational Form</span>
      </div>
      <p className="fw-helper">All run details remain editable. This shortened sample demonstrates packet review only; no automatic scoring or legal evaluation is applied.</p>
      <div className="fw-fields">
        <Field label="Primary Run Type" wide><select className={fieldClass} value={run.kind} onChange={(event) => patchRun({ kind: event.target.value as PrimaryKind | "" })}>
          <option value="">Select primary form</option>{PRIMARY_FORMS.map((form) => <option key={form.key} value={form.key}>{form.label}</option>)}
        </select></Field>
        <Field label="Incident / Run Number"><input className={`${fieldClass} fw-mono`} value={run.incident} onChange={(event) => patchRun({ incident: event.target.value })} /></Field>
        <Field label="Unit / Cruiser Assignment"><input className={`${fieldClass} fw-mono`} value={run.unit} onChange={(event) => patchRun({ unit: event.target.value })} /></Field>
        <Field label="Street Address" wide><input className={fieldClass} value={run.address} onChange={(event) => patchRun({ address: event.target.value })} /></Field>
        <Field label="City"><input className={fieldClass} value={run.city} onChange={(event) => patchRun({ city: event.target.value })} /></Field>
        <Field label="State"><input className={fieldClass} maxLength={2} value={run.state} onChange={(event) => patchRun({ state: event.target.value.toUpperCase() })} /></Field>
        <Field label="ZIP Code"><input className={fieldClass} value={run.zip} onChange={(event) => patchRun({ zip: event.target.value })} /></Field>
        <Field label="Zone"><input className={fieldClass} value={run.zone} onChange={(event) => patchRun({ zone: event.target.value })} /></Field>
        <Field label="Cruiser District"><input className={fieldClass} value={run.district} onChange={(event) => patchRun({ district: event.target.value })} /></Field>
        <Field label="Incident Date"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY" value={run.date} onChange={(event) => patchRun({ date: event.target.value })} /></Field>
        <Field label="Ingressed At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={run.ingress} onChange={(event) => patchRun({ ingress: event.target.value })} /></Field>
        <Field label="Dispatched At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={run.dispatched} onChange={(event) => patchRun({ dispatched: event.target.value })} /></Field>
        <Field label="Cleared At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={run.cleared} onChange={(event) => patchRun({ cleared: event.target.value })} /></Field>
        <RadioCodeField label="Dispatched 10-Code" value={run.code} placeholder="17 or 27" onChange={(value) => patchRun({ code: value })}
          onSuggest={suggestKind} />
        <RadioCodeField label="Situation Found 10-Code · Optional" value={run.situation} placeholder="Leave blank if not applicable"
          onChange={(value) => patchRun({ situation: value })} onSuggest={suggestKind} optional />
        <Field label="Clearance · Optional"><select className={fieldClass} value={run.clearance} onChange={(event) => patchRun({ clearance: event.target.value })}>
          <option value="">Not recorded</option><option value="1V">1V · Report and/or Citation</option><option value="2V">2V · Party Advised or No Report Needed</option>
          <option value="3V">3V · Arrest Made</option><option value="4V">4V · Non-Arrest Situation / Errand Completed</option>
        </select></Field>
        <Field label="Run Notes" wide><textarea className={fieldClass} rows={3} value={run.notes} onChange={(event) => patchRun({ notes: event.target.value })} placeholder="Add notes for this preview packet" /></Field>
      </div>
      <ChecklistSample title="Run Checklist Review · Sample" items={["Radio, call number, and MPS information reviewed", "Safe arrival, approach, and contact", "Information gathering and decision-making", "Accurate paperwork and supporting forms", "Clearance and report timing"]} checked={run.checklist} onChange={(checklist) => patchRun({ checklist })} />
      <label className="fw-review-confirm"><input type="checkbox" checked={run.reviewed} onChange={(event) => onRun({ ...run, reviewed: event.target.checked })} /><span>I reviewed this sample run checklist.</span></label>
    </section>;
  }
  const spec = SUPPLEMENTS.find((item) => item.key === step.supplement);
  if (!spec) return null;
  const runNumber = step.runId?.replace("run-", "") || "";
  return <section className="fw-form-card" aria-labelledby="supplement-title">
    <div className="fw-card-heading">
      <div><p className="label-caps">Page {step.page} · Phase I · Week 3 · Day 2</p><h2 id="supplement-title">{spec.label} · Run {runNumber}</h2></div>
      <span className="fw-sample-tag">Sample · Not Complete Operational Form</span>
    </div>
    <p className="fw-helper">Optional sample attached to this run. It does not create another incident or apply automatic scoring.</p>
    <ChecklistSample title={`${spec.label} · Sample Review`} items={spec.checks} checked={supplementChecks} onChange={setSupplementChecks} />
    <Field label="Form Notes" wide><textarea className={fieldClass} rows={4} value={supplementNotes} onChange={(event) => setSupplementNote(event.target.value)} placeholder="Add notes for this preview form" /></Field>
  </section>;
}

export function FocusedWorkflow() {
  const [duty, setDuty] = useState<DutyDraft>(makeDutyDraft);
  const [runs, setRuns] = useState<Record<string, RunDetails>>({});
  const [steps, setSteps] = useState<PacketStep[]>([{ id: "duty", title: "Reporting for Duty", page: 1, kind: "duty" }]);
  const [activeId, setActiveId] = useState("duty");
  const [nextRunNumber, setNextRunNumber] = useState(1);
  const [nextPageNumber, setNextPageNumber] = useState(2);
  const [supplementChecks, setSupplementChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [supplementNotes, setSupplementNotes] = useState<Record<string, string>>({});
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupPhase, setLookupPhase] = useState<"ask" | "review" | "failed">("ask");
  const [incidentInput, setIncidentInput] = useState("");
  const [lookupUnit, setLookupUnit] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupDraft, setLookupDraft] = useState<RunDetails>(blankRun());
  const [lookupReviewed, setLookupReviewed] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const commitLock = useRef(false);
  const active = steps.find((step) => step.id === activeId) || steps[0];
  const activeRun = active.runId ? runs[active.runId] : undefined;
  const packetSnapshot = useMemo(() => JSON.stringify({ duty, runs, steps, supplementChecks, supplementNotes }), [duty, runs, steps, supplementChecks, supplementNotes]);
  const saved = snapshot !== null && snapshot === packetSnapshot;
  const runCount = Object.keys(runs).length;
  const canAddRun = runCount === 0 || saved;
  const canAddSupplement = !!active.runId;
  const dutyCount = useMemo(() => DUTY_GROUPS.reduce((sum, group) => sum + group.items.length, 0), []);
  const saveLabel = saved ? `Saved in this preview · ${savedAt}` : snapshot ? "Changes not saved · previous snapshot retained" : "Not saved";

  const openNewRun = () => {
    commitLock.current = false;
    setLookupPhase("ask");
    setIncidentInput("");
    setLookupUnit(duty.unit);
    setLookupMessage("");
    setLookupDraft(blankRun(duty.unit));
    setLookupReviewed(false);
    setLookupOpen(true);
  };
  const updateLookupDraft = (patch: Partial<RunDetails>) => {
    setLookupDraft((current) => ({ ...current, ...patch, reviewed: false }));
    setLookupReviewed(false);
  };
  const applyDraftSuggestion = (code: string) => {
    if (code === "6") updateLookupDraft({ kind: "" });
    else {
      const suggestion = suggestRunKind(code);
      if (suggestion) updateLookupDraft({ kind: suggestion });
    }
  };
  const useSampleMatch = () => {
    const incident = incidentInput.trim();
    const unit = lookupUnit.trim();
    if (!incident || !unit) {
      setLookupMessage("Enter an incident number and unit before looking up a sample.");
      setLookupPhase("failed");
      return;
    }
    if (incident !== SAMPLE_INCIDENT || unit !== "DEMO-21") {
      setLookupMessage(`No sample dispatch record matches ${incident} for ${unit}. No details were added.`);
      setLookupPhase("failed");
      return;
    }
    setLookupDraft({
      ...blankRun(unit), incident: SAMPLE_INCIDENT, date: "06/12/2025", ingress: "06/12/2025 14:20",
      dispatched: "06/12/2025 14:24", cleared: "06/12/2025 15:05", code: "17",
      address: "100 Sample Street", city: "Columbus", state: "OH", zip: "43215", zone: "1", district: "Central",
    });
    setLookupReviewed(false);
    setLookupMessage("Synthetic sample match. Unit matching is simulated; no officer details are included.");
    setLookupPhase("review");
  };
  const continueManual = () => {
    setLookupDraft({ ...blankRun(lookupUnit.trim()), incident: incidentInput.trim(), unit: lookupUnit.trim() });
    setLookupReviewed(false);
    setLookupMessage("Manual entry selected. No dispatch details were imported.");
    setLookupPhase("review");
  };
  const acceptRun = () => {
    if (commitLock.current) return;
    if (!lookupDraft.kind) { setLookupMessage("Select a primary run type before adding this run."); return; }
    if (!lookupReviewed) { setLookupMessage("Review the run details and confirm your primary form selection before continuing."); return; }
    if (lookupDraft.state && !/^[A-Z]{2}$/.test(lookupDraft.state)) { setLookupMessage("Enter a two-letter state abbreviation or leave State blank."); return; }
    if (lookupDraft.zip && !/^\d{5}(?:-\d{4})?$/.test(lookupDraft.zip)) { setLookupMessage("Enter a 5-digit ZIP code or leave ZIP blank."); return; }
    commitLock.current = true;
    const runId = `run-${nextRunNumber}`;
    const step: PacketStep = { id: runId, title: `Run ${nextRunNumber}`, page: nextPageNumber, kind: "run", runId };
    setRuns((current) => ({ ...current, [runId]: { ...lookupDraft } }));
    setSteps((current) => [...current, step]);
    setNextRunNumber((current) => current + 1);
    setNextPageNumber((current) => current + 1);
    setActiveId(runId);
    setLookupOpen(false);
  };
  const addSupplement = (key: SupplementKey) => {
    const runId = active.runId;
    if (!runId) return;
    const existing = steps.find((step) => step.kind === "supplement" && step.runId === runId && step.supplement === key);
    if (existing) { setActiveId(existing.id); return; }
    const spec = SUPPLEMENTS.find((item) => item.key === key);
    if (!spec) return;
    const id = `${runId}-supp-${key}`;
    setSteps((current) => [...current, { id, title: spec.label, page: nextPageNumber, kind: "supplement", runId, supplement: key }]);
    setNextPageNumber((current) => current + 1);
    setActiveId(id);
  };
  const savePacket = () => {
    setSnapshot(packetSnapshot);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  };
  const setActiveRun = (next: RunDetails) => {
    if (!active.runId) return;
    setRuns((current) => ({ ...current, [active.runId as string]: next }));
  };
  const moveStep = (direction: -1 | 1) => {
    const index = steps.findIndex((step) => step.id === activeId);
    const target = steps[index + direction];
    if (target) setActiveId(target.id);
  };
  const titleFor = (step: PacketStep) => {
    if (step.kind === "duty") return step.title;
    if (step.kind === "run") {
      const incident = step.runId ? runs[step.runId]?.incident : "";
      return incident ? `Run ${step.runId?.replace("run-", "")} · ${incident}` : `Run ${step.runId?.replace("run-", "")}`;
    }
    return `${step.title} · Run ${step.runId?.replace("run-", "") || ""}`;
  };
  const activeTitle = active.kind === "duty" ? active.title
    : active.kind === "run" ? `Run ${active.runId?.replace("run-", "") || ""} · ${activeRun?.incident || "Run Sheet"}`
      : `${SUPPLEMENTS.find((item) => item.key === active.supplement)?.label || active.title} · Run ${active.runId?.replace("run-", "") || ""}`;

  return <main className="fto-preview fw-shell">
    <header className="fw-topbar">
      <div className="fw-brand">
        <img src="/__mockup/images/fto-columbus-logo.svg" alt="Columbus Division of Police" />
        <div><p className="label-caps">Field Training Officer Portal</p><h1>Shift Packet</h1></div>
      </div>
      <div className="fw-session"><span className="fw-demo-pill"><ShieldCheck size={15} /> Fictional Preview</span><span className="fw-session-copy">Phase I · Week 3 · Day 2</span></div>
    </header>
    <div className="fw-disclaimer"><span>Fictional preview only · No live CAD · Reloading resets this preview</span><span>FTO workspace</span></div>
    <div className="fw-layout">
      <aside className="fw-rail" aria-label="Packet navigation">
        <div className="fw-rail-title"><div><p className="label-caps">Current Packet</p><strong>{runCount ? `${runCount} Run${runCount === 1 ? "" : "s"}` : "Shift Not Started"}</strong></div><span className="fw-status-dot" /></div>
        <ol className="fw-step-list">{steps.map((step, index) => <li key={step.id}>
          <button type="button" className={`fw-step-button${activeId === step.id ? " is-active" : ""}`} aria-current={activeId === step.id ? "step" : undefined} onClick={() => setActiveId(step.id)}>
            <span className="fw-step-index">{index + 1}</span><span className="fw-step-copy"><b>{titleFor(step)}</b><small>Page {step.page} · Phase I W3D2</small></span>
            {activeId === step.id && <ChevronRight size={16} />}
          </button>
        </li>)}</ol>
        <div className="fw-add-block">
          <p className="label-caps">Quick Add · Current Run</p>
          <div className="fw-add-actions">{SUPPLEMENTS.map((item) => <button key={item.key} type="button" disabled={!canAddSupplement}
            title={!canAddSupplement ? "Open a run page before adding supplemental forms." : `Add ${item.label} to this run`}
            onClick={() => addSupplement(item.key)}><Plus size={14} />{item.label}</button>)}</div>
          {!canAddSupplement && <p className="fw-quick-hint">Open a run in the packet to add its forms.</p>}
        </div>
        <div className="fw-rail-note"><b>{dutyCount} source duty checklist items</b><span>Exact extracted labels · one form at a time</span></div>
      </aside>
      <section className="fw-work-area">
        <div className="fw-work-heading">
          <div><p className="label-caps">Page {active.page} of {steps.length} · Phase I · Week 3 · Day 2</p><h2>{activeTitle}</h2></div>
          <div className={`fw-save-state${saved ? " is-saved" : ""}`} role="status">{saved && <Check size={15} />}{saveLabel}</div>
        </div>
        {active.kind === "duty" && <div className="fw-intro"><span className="fw-intro-mark">P1</span><div><b>Reporting for Duty</b><p>Complete the duty form first. Your current unit preloads for each new run.</p></div></div>}
        {active.kind === "run" && <div className="fw-intro"><span className="fw-intro-mark">{active.page}</span><div><b>Run Details</b><p>Each run and its additional forms remain separate in this daily packet.</p></div></div>}
        <div className="fw-scroll-region" key={active.id}>
          {active.kind === "duty" ? <DutyForm value={duty} onChange={setDuty} /> :
            <FocusedForm step={active} duty={duty} onDuty={setDuty} run={activeRun || blankRun()} onRun={setActiveRun}
              supplementChecks={supplementChecks[active.id] || {}} setSupplementChecks={(checks) => setSupplementChecks((current) => ({ ...current, [active.id]: checks }))}
              supplementNotes={supplementNotes[active.id] || ""} setSupplementNote={(value) => setSupplementNotes((current) => ({ ...current, [active.id]: value }))} />}
        </div>
        <footer className="fw-controls">
          <button type="button" className="fw-secondary" onClick={() => moveStep(-1)} disabled={steps.findIndex((step) => step.id === activeId) <= 0}><ArrowLeft size={16} /> Previous</button>
          <span className="fw-control-hint">Forms stay in this packet while you move between pages.</span>
          <div className="fw-control-actions">
            <button type="button" className="fw-secondary" onClick={() => moveStep(1)} disabled={steps.findIndex((step) => step.id === activeId) >= steps.length - 1}>Next <ArrowRight size={16} /></button>
            <button type="button" className="fw-primary" onClick={savePacket}><Save size={15} /> Save Packet</button>
            <button type="button" className="fw-secondary" disabled={!canAddRun} title={!canAddRun ? "Save the current packet changes before adding another run." : "Start a new run without replacing existing packet forms."}
              onClick={openNewRun}><Plus size={15} /> New Run</button>
          </div>
        </footer>
      </section>
    </div>

    <AlertDialog open={lookupOpen} onOpenChange={(open) => { setLookupOpen(open); if (!open) setLookupPhase("ask"); }}>
      <AlertDialogContent className="fw-dialog">
        <AlertDialogHeader><AlertDialogTitle>{lookupPhase === "review" ? "Review Run Details" : "Start a New Run"}</AlertDialogTitle>
          <AlertDialogDescription>{lookupPhase === "review" ? "Review and edit all draft details, select the primary form, and confirm before adding this run to the packet." : "Lookup runs only after you enter an incident number and choose Look Up. Lookup data is synthetic and stays in this unsaved dialog draft."}</AlertDialogDescription>
        </AlertDialogHeader>
        {lookupPhase !== "review" ? <div className="fw-dialog-fields">
          <Field label="Incident / Run Number"><input autoFocus className={`${fieldClass} fw-mono`} value={incidentInput}
            onChange={(event) => { setIncidentInput(event.target.value); if (lookupPhase === "failed") setLookupPhase("ask"); }} /></Field>
          <Field label="Unit / Cruiser Assignment"><input className={`${fieldClass} fw-mono`} value={lookupUnit}
            onChange={(event) => { setLookupUnit(event.target.value); if (lookupPhase === "failed") setLookupPhase("ask"); }} /></Field>
          <p className="fw-example">Synthetic lookup example: incident <b className="fw-mono">{SAMPLE_INCIDENT}</b> for unit <b className="fw-mono">DEMO-21</b>. Unit matching is simulated; no officer details are returned.</p>
          {lookupPhase === "failed" && <div className="fw-inline-alert" role="alert">{lookupMessage}</div>}
        </div> : <div className="fw-dialog-fields">
          {lookupMessage && <div className="fw-inline-alert" role="status">{lookupMessage}</div>}
          <Field label="Primary Run Type · Required" wide><select className={fieldClass} value={lookupDraft.kind}
            onChange={(event) => updateLookupDraft({ kind: event.target.value as PrimaryKind | "" })}>
            <option value="">Select primary form</option>{PRIMARY_FORMS.map((form) => <option key={form.key} value={form.key}>{form.label}</option>)}
          </select></Field>
          {lookupDraft.code === "17" && <p className="fw-example">10-17 · Domestic Violence. This code can suggest Domestic Incident; select or confirm the primary form manually.</p>}
          {lookupDraft.code === "27" && <p className="fw-example">10-27 · Assault or Hospital Report. Select the primary form manually.</p>}
          <Field label="Incident / Run Number"><input className={`${fieldClass} fw-mono`} value={lookupDraft.incident} onChange={(event) => updateLookupDraft({ incident: event.target.value })} /></Field>
          <Field label="Unit / Cruiser Assignment"><input className={`${fieldClass} fw-mono`} value={lookupDraft.unit} onChange={(event) => updateLookupDraft({ unit: event.target.value })} /></Field>
          <Field label="Incident Date"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY" value={lookupDraft.date} onChange={(event) => updateLookupDraft({ date: event.target.value })} /></Field>
          <Field label="Ingressed At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={lookupDraft.ingress} onChange={(event) => updateLookupDraft({ ingress: event.target.value })} /></Field>
          <Field label="Dispatched At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={lookupDraft.dispatched} onChange={(event) => updateLookupDraft({ dispatched: event.target.value })} /></Field>
          <Field label="Cleared At"><input className={`${fieldClass} fw-mono`} placeholder="MM/DD/YYYY HH:MM" value={lookupDraft.cleared} onChange={(event) => updateLookupDraft({ cleared: event.target.value })} /></Field>
          <RadioCodeField label="Dispatched 10-Code" value={lookupDraft.code} placeholder="17 or 27" onChange={(code) => updateLookupDraft({ code })}
            onSuggest={applyDraftSuggestion} />
          <RadioCodeField label="Situation Found 10-Code · Optional" value={lookupDraft.situation} placeholder="Leave blank if not applicable"
            onChange={(situation) => updateLookupDraft({ situation })} onSuggest={applyDraftSuggestion} optional />
          <Field label="Street Address" wide><input className={fieldClass} value={lookupDraft.address} onChange={(event) => updateLookupDraft({ address: event.target.value })} /></Field>
          <Field label="City"><input className={fieldClass} value={lookupDraft.city} onChange={(event) => updateLookupDraft({ city: event.target.value })} /></Field>
          <Field label="State"><input className={fieldClass} maxLength={2} value={lookupDraft.state} onChange={(event) => updateLookupDraft({ state: event.target.value.toUpperCase() })} /></Field>
          <Field label="ZIP Code"><input className={fieldClass} value={lookupDraft.zip} onChange={(event) => updateLookupDraft({ zip: event.target.value })} /></Field>
          <Field label="Zone"><input className={fieldClass} value={lookupDraft.zone} onChange={(event) => updateLookupDraft({ zone: event.target.value })} /></Field>
          <Field label="Cruiser District"><input className={fieldClass} value={lookupDraft.district} onChange={(event) => updateLookupDraft({ district: event.target.value })} /></Field>
          <Field label="Clearance · Optional"><select className={fieldClass} value={lookupDraft.clearance} onChange={(event) => updateLookupDraft({ clearance: event.target.value })}>
            <option value="">Not recorded</option><option value="1V">1V · Report and/or Citation</option><option value="2V">2V · Party Advised or No Report Needed</option>
            <option value="3V">3V · Arrest Made</option><option value="4V">4V · Non-Arrest Situation / Errand Completed</option>
          </select></Field>
          <label className="fw-review-confirm fw-wide"><input type="checkbox" checked={lookupReviewed} onChange={(event) => setLookupReviewed(event.target.checked)} />
            <span>I reviewed all run details and explicitly selected or confirmed the primary run type.</span></label>
        </div>}
        <AlertDialogFooter className="fw-dialog-footer">
          <AlertDialogCancel onClick={() => setLookupOpen(false)}>Cancel</AlertDialogCancel>
          {lookupPhase !== "review" ? <>
            <button type="button" className="fw-secondary" onClick={continueManual}>Enter Manually</button>
            <button type="button" className="fw-primary" disabled={!incidentInput.trim() || !lookupUnit.trim()} onClick={useSampleMatch}><Search size={15} /> Look Up</button>
          </> : <button type="button" className="fw-primary" disabled={!lookupDraft.kind || !lookupReviewed} onClick={acceptRun}>Add Run to Packet <ArrowRight size={15} /></button>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}
