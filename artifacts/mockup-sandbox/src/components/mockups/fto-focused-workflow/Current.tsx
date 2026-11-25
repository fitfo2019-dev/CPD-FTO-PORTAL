import { useState } from "react";
import { DutyForm, makeDutyDraft } from "./_source.js";
import "./_group.css";

/** Exact-source duty-stage extraction, not a replacement application route. */
export function Current() {
  const [draft,setDraft]=useState(makeDutyDraft);
  return <div className="fto-preview min-h-screen bg-background p-6">
    <div className="mx-auto max-w-5xl">
      <p className="label-caps mb-2">Current Source · Isolated Duty Form</p>
      <h1 className="mb-3 text-3xl">Reporting for Duty</h1>
      <p className="mb-5 text-sm text-muted-foreground">Source reference for comparison. Fictional data, memory only; reloading resets this preview. No agency systems are connected.</p>
      <DutyForm value={draft} onChange={setDraft}/>
    </div>
  </div>;
}
