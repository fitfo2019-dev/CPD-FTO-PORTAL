import { useState } from "react";
import { DutyForm, makeDutyDraft } from "./_source.js";
import "./_group.css";
import "./_commentary-cleanup.css";

/** Approval-only copy review of the already extracted source duty panel.
 * The scoped CSS omits its explanatory paragraph for comparison. An approved
 * portal edit would remove that JSX node, not ship a CSS visibility rule.
 * All controls and their mock state handlers remain the original extraction. */
export function CommentaryCleanupPreview() {
  const [draft, setDraft] = useState(makeDutyDraft);
  return (
    <div className="fto-preview copy-cleanup-preview min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <p className="label-caps mb-2">Proposed copy cleanup · Approval preview</p>
        <h1 className="mb-3 text-3xl">Reporting for Duty</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          The technical explanation above the fields is removed. Checklist labels,
          controls, and the FTO’s review confirmation remain unchanged.
        </p>
        <p className="mb-5 text-sm text-muted-foreground">
          Fictional test values only. Nothing is saved or uploaded; reloading resets this preview.
        </p>
        <DutyForm value={draft} onChange={setDraft} />
      </div>
    </div>
  );
}
