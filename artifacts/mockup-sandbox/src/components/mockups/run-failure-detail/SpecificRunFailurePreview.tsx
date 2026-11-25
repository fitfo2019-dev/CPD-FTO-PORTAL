import { useState } from "react";
import { AlertTriangle, Check, CircleHelp, X } from "lucide-react";
import "./_group.css";

const parentLabel = "Properly cleared with radio and MPS the appropriate disposition code";
const choices = [
  "Notify radio of the appropriate disposition code",
  "Clear in MPS using the appropriate disposition code",
];

export function SpecificRunFailurePreview() {
  const [dialogOpen, setDialogOpen] = useState(true);
  const [draft, setDraft] = useState<string[]>([choices[0]]);
  const [confirmed, setConfirmed] = useState<string[]>([choices[0]]);
  const [saved, setSaved] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  const toggleChoice = (choice: string) => {
    setDraft((current) =>
      current.includes(choice)
        ? current.filter((item) => item !== choice)
        : [...current, choice],
    );
  };

  const cancel = () => {
    setDraft(confirmed);
    setCheckboxChecked(true);
    setDialogOpen(false);
  };

  const confirm = () => {
    if (!draft.length) return;
    setConfirmed(draft);
    setSaved(true);
    setCheckboxChecked(false);
    setDialogOpen(false);
  };

  return (
    <main className="failure-preview min-h-screen px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 border-b-2 border-[#004d80] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#004d80]">
                Field Training Officer Portal · Run Forms
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Specific Run Failures</h1>
              <p className="mt-1 text-sm text-[#57575b]">
                A focused preview of a combined checklist item.
              </p>
            </div>
            <div className="rounded border border-[#9a6b00]/40 bg-[#fff7df] px-3 py-2 text-xs font-bold text-[#684800]">
              Preview Only · Fictional Data
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 border-l-4 border-[#9b1c1c] bg-white px-3 py-2 text-xs leading-5 text-[#444]">
            <CircleHelp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#004d80]" />
            <p>
              Unchecking a combined item asks which actions were not completed.
              Cancel keeps the item checked; confirm saves only the selected actions.
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded border border-[#c8d0d8] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#d6dce2] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#004d80]">
                  Call for Service · Clearance
                </p>
                <h2 className="mt-1 text-lg font-bold">Checklist Item</h2>
              </div>
              <span className="rounded bg-[#edf2f6] px-2 py-1 text-xs font-semibold text-[#34485b]">
                Sample Run
              </span>
            </div>

            <div className="mt-4 rounded border border-[#d9dee4] bg-[#fbfcfd] p-3">
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  aria-label={`Completed: ${parentLabel}`}
                  checked={checkboxChecked}
                  onChange={() => setDialogOpen(true)}
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#004d80]"
                />
                <span>{parentLabel}</span>
              </label>
              {saved && confirmed.length > 0 && (
                <div className="mt-3 border-l-2 border-[#9b1c1c] pl-3" aria-live="polite">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b2424]">
                    Specific Actions Not Completed
                  </p>
                  <ul className="mt-1 space-y-1 text-sm leading-5">
                    {confirmed.map((action) => (
                      <li className="failure-action" key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {checkboxChecked && (
                <p className="mt-2 text-xs font-semibold text-[#355c38]" role="status">
                  No failure detail was saved. The item remains checked.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded border border-[#004d80] bg-[#004d80] px-3 text-sm font-bold text-white hover:bg-[#003b63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d80]"
                onClick={() => {
                  setDraft(confirmed);
                  setDialogOpen(true);
                  setCheckboxChecked(false);
                }}
                type="button"
              >
                Review Failure Details
              </button>
              <button
                className="min-h-10 rounded border border-[#9b1c1c] bg-white px-3 text-sm font-bold text-[#8c2020] hover:bg-[#fff3f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]"
                onClick={() => {
                  setSaved(false);
                  setConfirmed([]);
                  setCheckboxChecked(true);
                }}
                type="button"
              >
                Clear Sample Detail
              </button>
            </div>
          </section>

          <section className="rounded border border-[#c8d0d8] bg-[#f8fafc] p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#9b1c1c]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#004d80]">
                  Prompt When Clearing
                </p>
                <h2 className="mt-1 text-lg font-bold">Identify What Was Not Completed</h2>
                <p className="mt-1 text-sm leading-5 text-[#4f5862]">
                  Select every specific action that applies. The source checklist
                  label stays unchanged.
                </p>
              </div>
            </div>

            {dialogOpen ? (
              <div
                aria-describedby="failure-dialog-description"
                aria-labelledby="failure-dialog-title"
                aria-modal="true"
                className="failure-dialog mt-4 rounded border border-[#b7c2ce] bg-white p-4"
                role="dialog"
                tabIndex={-1}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#9b1c1c]">
                      Failure Detail
                    </p>
                    <h3 className="mt-1 text-base font-bold" id="failure-dialog-title">
                      Select Specific Actions
                    </h3>
                  </div>
                  <button
                    aria-label="Cancel and keep the item checked"
                    className="rounded p-1 text-[#45515d] hover:bg-[#edf2f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#004d80]"
                    onClick={cancel}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 rounded bg-[#f1f4f7] p-2 text-sm font-semibold leading-5">
                  {parentLabel}
                </p>
                <p className="mt-3 text-sm leading-5 text-[#4f5862]" id="failure-dialog-description">
                  Choose one or both actions the PO did not complete acceptably.
                </p>
                <div className="mt-3 space-y-2">
                  {choices.map((choice) => (
                    <label
                      className="failure-choice flex cursor-pointer items-start gap-3 rounded border border-[#d1d8df] p-3 text-sm leading-5 hover:bg-[#f6f9fb]"
                      key={choice}
                    >
                      <input
                        checked={draft.includes(choice)}
                        className="mt-0.5 h-4 w-4 accent-[#004d80]"
                        onChange={() => toggleChoice(choice)}
                        type="checkbox"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 min-h-5 text-xs font-semibold text-[#8c2020]" aria-live="polite">
                  {draft.length ? `${draft.length} action${draft.length === 1 ? "" : "s"} selected` : "Select at least one action to confirm."}
                </p>
                <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-[#e0e5e9] pt-3">
                  <button
                    className="min-h-10 rounded border border-[#9aa6b2] bg-white px-3 text-sm font-bold text-[#34485b] hover:bg-[#f2f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d80]"
                    onClick={cancel}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-[#004d80] bg-[#004d80] px-3 text-sm font-bold text-white hover:bg-[#003b63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d80] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!draft.length}
                    onClick={confirm}
                    type="button"
                  >
                    <Check aria-hidden="true" className="h-4 w-4" />
                    Confirm Failure
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded border border-[#c8d0d8] bg-white p-4" role="status">
                <p className="font-bold">Prompt Closed</p>
                <p className="mt-1 text-sm text-[#4f5862]">
                  {checkboxChecked
                    ? "Cancel restored the completed state."
                    : "The confirmed details remain attached to this sample run."}
                </p>
                <button
                  className="mt-3 min-h-10 rounded border border-[#004d80] bg-[#004d80] px-3 text-sm font-bold text-white hover:bg-[#003b63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004d80]"
                  onClick={() => {
                    setDraft(confirmed);
                    setDialogOpen(true);
                    setCheckboxChecked(false);
                  }}
                  type="button"
                >
                  Open Failure Details
                </button>
              </div>
            )}
          </section>
        </div>
        <footer className="mt-4 border-t border-[#c8d0d8] pt-3 text-xs leading-5 text-[#57575b]">
          This preview uses fictional sample data. It does not create, save, or
          change a portal record.
        </footer>
      </div>
    </main>
  );
}
