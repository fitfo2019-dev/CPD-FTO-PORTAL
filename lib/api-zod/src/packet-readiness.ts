/** Submission is stricter than editable draft storage. This does not infer or
 * alter any rating, checklist answer, narrative, or activity total. */
export function packetSubmissionReady(report:Record<string,unknown>):boolean {
  const duty=report.reportingForDuty;
  if(!duty||typeof duty!=="object"||Array.isArray(duty)||
    typeof (duty as Record<string,unknown>).reviewedAt!=="string") return false;
  if(!report.limboDay&&typeof report.ratingsReviewedAt!=="string") return false;
  if(!Array.isArray(report.runs)||!report.runs.every(run=>run&&typeof run==="object"&&
    run.formStatus==="complete"&&typeof run.checklistReviewedAt==="string")) return false;
  return true;
}
