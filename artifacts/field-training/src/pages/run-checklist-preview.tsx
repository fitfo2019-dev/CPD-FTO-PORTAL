import { useState } from 'react';
import { RunChecklistFields } from '@/components/run-checklist-fields.js';
import { DAILY_ACTIVITY_FIELDS, PRIMARY_RUN_FORMS, SUPPLEMENTAL_RUN_FORMS, type PrimaryRunForm, type TrainingRun, type SupplementalRunForm } from '@/lib/model.js';
import { RunOptionsDialog } from '@/components/run-options-dialog.js';
import { REVISED_PRIMARY_CHECKLISTS, REVISED_SUPPLEMENT_CHECKLISTS, setRevisedRow } from '@/lib/revised-run-checklists.js';

/** Isolated development approval preview: no workspace, persistence, or API. */
export default function RunChecklistPreview() {
  const query = new URLSearchParams(window.location.search);
  const forms = [...PRIMARY_RUN_FORMS, ...SUPPLEMENTAL_RUN_FORMS.filter(form => form.key === 'arrest_process' || form.key === 'ovi_process')];
  const [form, setForm] = useState(query.get('form') ?? 'call_for_service');
  const [readOnly, setReadOnly] = useState(query.get('state') === 'readonly');
  const [dark, setDark] = useState(query.get('theme') === 'dark');
  const [optionsOpen,setOptionsOpen]=useState(query.get('options')==='1');
  const [trafficMode,setTrafficMode]=useState<TrainingRun['trafficMode']>('none');
  const [attached,setAttached]=useState<SupplementalRunForm[]>([]);
  const [activity,setActivity]=useState<NonNullable<TrainingRun['activityFlags']>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, boolean>>>(
    query.get('state') === 'mixed' || query.get('state') === 'readonly' ? { [form]: { 'task-0': false } } : {},
  );
  const chosen = forms.find(item => item.key === form) ?? forms[0];
  const sections = chosen.key === 'arrest_process' || chosen.key === 'ovi_process'
    ? REVISED_SUPPLEMENT_CHECKLISTS[chosen.key] : REVISED_PRIMARY_CHECKLISTS[chosen.key as PrimaryRunForm];
  const state = answers[chosen.key] ?? {};
  return <div className={dark ? 'dark' : ''}>
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b-2 border-amber-500 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
        FICTIONAL DESIGN PREVIEW · Memory only · No training-record access or saving
      </div>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Columbus Division of Police · Field Training Office</p>
          <h1 className="mt-2 text-2xl font-bold">Revised run checklist preview</h1>
          <p className="mt-2 text-sm text-muted-foreground">Fixed sections and uniform checkbox rows. Changing answers never hides or moves a section.</p>
        </header>
        <div className="flex flex-wrap items-center gap-4 rounded border bg-card p-4">
          <label className="grid min-w-0 basis-full gap-1 text-sm font-semibold sm:flex-1 sm:basis-auto">Form
            <select value={chosen.key} onChange={event => setForm(event.target.value)} className="min-h-11 max-w-full rounded border bg-background p-2">
              {forms.map(item => <option key={item.key} value={item.key}>{item.label} · {item.formNumber}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={readOnly} onChange={event => setReadOnly(event.target.checked)} />Read-only</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)} />Dark mode</label>
          <button className="min-h-11 rounded border px-3 text-sm" onClick={() => setAnswers(current => ({ ...current, [chosen.key]: {} }))}>Reset test answers</button>
        </div>
        <button type="button" onClick={()=>setOptionsOpen(true)} className="min-h-11 rounded border bg-card px-4 text-sm font-bold">Preview Optional Items Popup</button>
        <RunOptionsDialog open={optionsOpen} onOpenChange={setOptionsOpen} disabled={readOnly} className={dark?'dark':undefined}
          showTraffic trafficMode={trafficMode} onTrafficChange={setTrafficMode}
          forms={SUPPLEMENTAL_RUN_FORMS.map(item=>({key:item.key,label:item.label,selected:attached.includes(item.key)}))}
          onFormChange={(key,selected)=>setAttached(current=>selected?[...current,key]:current.filter(item=>item!==key))}
          activities={DAILY_ACTIVITY_FIELDS.map(item=>({...item,selected:!!activity[item.key]}))}
          onActivityChange={(key,selected)=>setActivity(current=>({...current,[key]:selected}))}
          onClearActivities={()=>setActivity({})}
          activityHint="Fictional preview only. Choose completed activities; nothing is saved or counted."/>
        <section className="min-w-0 rounded border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-bold">{chosen.label}</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Check a row only when every listed action was completed. Mixed rows preserve their original individual answers until changed.</p>
          <RunChecklistFields sections={sections} state={state} prefix="task-" disabled={readOnly}
            testId="preview-run-checklist" onChange={(indices, checked) => setAnswers(current => ({
              ...current, [chosen.key]: setRevisedRow(current[chosen.key] ?? {}, 'task-', indices, checked),
            }))} />
        </section>
      </div>
    </main>
  </div>;
}
