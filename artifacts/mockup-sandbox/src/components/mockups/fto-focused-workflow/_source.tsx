import type { ReactNode } from "react";
import "./_group.css";

/** Copied taxonomy: field-training/src/lib/model.ts DAILY_DUTY_CHECKLIST.
 * Auth, workspace context, persistence and deficiency side effects are stubbed
 * at this boundary. The UI is copied from report-editor.tsx's duty stage. */
export const DUTY_GROUPS = [
  {section:"Appearance/Equipment",items:[
    {key:"reported_on_time",label:"Reported to assignment in timely manner"},
    {key:"uniform_appearance",label:"Uniform Appearance-neat, pressed & shined"},
    {key:"professional_appearance",label:"Professional personal appearance"},
    {key:"prepared_for_duties",label:"Prepared to assume duties (paperwork/personal assigned equipment)"},
    {key:"checked_daily_bulletin",label:"Checked Division email/Daily Bulletin"},
    {key:"interacted_with_team",label:"Interacted with peers/supervisors"},
    {key:"assigned_shotgun",label:"Assigned shotgun"},
  ]},
  {section:"Roll Call/Cruiser Inspection",items:[
    {key:"participated_in_roll_call",label:"Participated in daily roll call"},
    {key:"inspected_cruiser_start",label:"Conducted inspection of cruiser (cleanliness, damage, weapons, contraband, equipment, etc.)"},
    {key:"inspected_assigned_equipment",label:"Conducted inspection of assigned equipment"},
    {key:"reported_equipment_issue",label:"Reported cruiser damage/missing equipment to supervisor"},
    {key:"turned_on_cvs",label:"Log on CVS"},
    {key:"signed_on_mps",label:"Turned on/signed onto MPS"},
    {key:"carried_forms",label:"Carried necessary forms/booklets/paperwork/manuals"},
    {key:"unit_assignment_one",label:"Worked as a one officer unit"},
    {key:"unit_assignment_two",label:"Worked as a two officer unit"},
    {key:"po_drove",label:"PO drove during tour of duty"},
    {key:"bwc_operational",label:"BWC Operational"},
  ]},
  {section:"Marking out of Service",items:[
    {key:"inspected_cruiser_end",label:"Conducted inspection of cruiser (cleanliness, damage, weapons, contraband, equipment,etc.)"},
    {key:"cruiser_half_tank",label:"Cruiser ½ tank of gas"},
    {key:"turned_off_cvs",label:"Log off CVS"},
    {key:"signed_off_mps",label:"Signed off/turned off MPS"},
    {key:"turned_in_paperwork",label:"Turned in completed paperwork"},
    {key:"returned_equipment",label:"Returned assigned equipment to substation (unloaded shotgun, keys, Taser, etc)"},
    {key:"docked_bwc",label:"Properly dock BWC"},
  ]},
  {section:"Shotgun Training (FTO demonstrated & PO should repeatedly perform this training)",items:[
    {key:"shotgun_readiness",label:"The different stages of readiness"},
    {key:"shotgun_loading",label:"Method of loading/unloading"},
    {key:"shotgun_cruiser_ready",label:"Made shotgun “cruiser ready”"},
    {key:"shotgun_loaded_round",label:"Loaded round into shotgun"},
    {key:"shotgun_cleared",label:"Cleared shotgun & made shotgun “cruiser ready”"},
    {key:"shotgun_unloaded",label:"Unloaded the shotgun"},
    {key:"shotgun_bullet_trap",label:"Utilized bullet trap system"},
    {key:"shotgun_proficiency",label:"Demonstrated shotgun proficiency"},
  ]},
] as const;

export type DutyDraft = {
  unit: string; shotgun: ""|"Y"|"N"; status: string; notes: string; reviewed: boolean;
  checklist: Record<string,boolean>; notApplicable: Record<string,boolean>;
};
export const makeDutyDraft = ():DutyDraft => ({
  unit:"DEMO-21",shotgun:"",status:"on_duty",notes:"",reviewed:false,
  checklist:Object.fromEntries(DUTY_GROUPS.flatMap(g=>g.items.map(i=>[i.key,true]))),
  notApplicable:Object.fromEntries(DUTY_GROUPS.map(g=>[g.section,false])),
});
const inp="h-10 w-full rounded border bg-card px-3 text-sm disabled:opacity-70";
function F({l,children}:{l:string;children:ReactNode}) { return <label className="block space-y-1"><span className="label-caps">{l}</span>{children}</label>; }
function help(section:string,item:string) { return `Reporting for Duty · ${section}: indicates the PO ${item.toLowerCase()}. Clearing an applicable task creates a UA deficiency. Use the section's Not applicable control when the section does not apply.`; }

export function DutyForm({value:r,onChange,children}:{value:DutyDraft;onChange:(next:DutyDraft)=>void;children?:ReactNode}) {
  const allChecked=DUTY_GROUPS.every(g=>g.items.every(i=>r.checklist[i.key]!==false));
  const change=(patch:Partial<DutyDraft>)=>onChange({...r,...patch,reviewed:false});
  return <section id="duty-form" className="min-w-0 rounded-md border bg-card">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b"><h2 className="label-caps min-w-0 text-foreground mr-auto">Reporting for Duty Form</h2>{children}</div>
    <div className="border-b px-4 py-3 text-sm text-muted-foreground">New daily logs start with duty-check boxes selected to speed entry. Review every item; clearing an applicable task creates a UA deficiency. Each section’s <b>Not applicable</b> box starts unchecked; use it for an inapplicable section. Confirm the review before submission.</div>
    <div className="grid gap-4 p-4">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <F l="Unit / cruiser assignment"><input value={r.unit} maxLength={40} className={inp+" mono"} onChange={e=>change({unit:e.target.value})} placeholder="Enter assigned unit or cruiser" data-testid="input-unit-number"/></F>
        <F l="Shotgun Training"><select className={inp} value={r.shotgun} onChange={e=>{const v=e.target.value;if(v==="Y"||v==="N")change({shotgun:v});}} data-testid="select-shotgun-training"><option value="" disabled>Select Y / N</option><option value="Y">Y</option><option value="N">N</option></select></F>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 p-3"><span className="text-sm font-semibold">Reporting for Duty form checkboxes</span><button type="button" onClick={()=>change({checklist:Object.fromEntries(DUTY_GROUPS.flatMap(g=>g.items.map(i=>[i.key,!allChecked])))})} className="min-h-11 rounded border bg-card px-4 text-sm font-bold" data-testid="button-toggle-duty-checklist">{allChecked?"Deselect all":"Select all"}</button></div>
      <F l="Duty status"><div role="radiogroup" aria-label="Duty status" className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[{value:"on_duty",label:"On duty"},{value:"training",label:"Training"},{value:"sick",label:"Sick"},{value:"off_duty",label:"Off duty"},{value:"other",label:"Other"}].map(o=><label key={o.value} className={`flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold ${r.status===o.value?"border-primary bg-primary/10":"bg-card"}`}><input type="radio" name="duty-status" checked={r.status===o.value} onChange={()=>change({status:o.value})}/>{o.label}</label>)}</div></F>
      {DUTY_GROUPS.map(group=><fieldset key={group.section} className="rounded border p-3">
        <legend className="px-2 text-sm font-bold">{group.section}</legend>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-10 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" checked={!!r.notApplicable[group.section]} onChange={e=>change({notApplicable:{...r.notApplicable,[group.section]:e.target.checked}})}/>Not applicable</label>
          <button type="button" onClick={()=>change({checklist:{...r.checklist,...Object.fromEntries(group.items.map(i=>[i.key,false]))}})} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive">Clear all checkboxes</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">{group.items.map(item=><label key={item.key} title={help(group.section,item.label)} className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" disabled={!!r.notApplicable[group.section]} checked={r.checklist[item.key]!==false} onChange={e=>change({checklist:{...r.checklist,[item.key]:e.target.checked}})}/><span>{item.label}</span></label>)}</div>
      </fieldset>)}
      <label className="flex items-start gap-2 rounded border p-3 text-sm leading-5"><input type="checkbox" checked={r.reviewed} onChange={e=>onChange({...r,reviewed:e.target.checked})} data-testid="checkbox-duty-review"/><span>I reviewed the daily duty checklist and cleared non-applicable or incomplete items. The “Not applicable” boxes remain unchecked unless I selected them.</span></label>
      <F l="Duty form notes"><textarea rows={2} value={r.notes} onChange={e=>change({notes:e.target.value})} className="w-full rounded border bg-card p-2.5 text-sm" placeholder="FTO drove during tour; FTO ______ substituting for FTO ______."/></F>
    </div>
  </section>;
}

