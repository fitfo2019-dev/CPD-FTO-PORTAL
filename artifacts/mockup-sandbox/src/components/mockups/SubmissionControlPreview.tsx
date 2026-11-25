import { useState } from "react";

type PreviewState = "draft" | "confirm" | "preview-confirmed";

const styles = `
  .submission-preview {
    --sp-ink: #17324d;
    --sp-muted: #5c6670;
    --sp-blue: #00548f;
    --sp-red: #b3262d;
    --sp-line: #c9d0d5;
    --sp-paper: #fff;
    min-height: 100dvh;
    padding: 22px 28px 30px;
    background: #e9ecee;
    color: #41484e;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .submission-preview * { box-sizing: border-box; }
  .sp-frame { width: min(100%, 1130px); margin: 0 auto; }
  .sp-preview-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 15px;
    padding: 8px 12px;
    border: 1px solid #d7b573;
    background: #fff8e9;
    color: #654b1f;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .075em;
    text-transform: uppercase;
  }
  .sp-preview-banner strong { color: #8b2528; }
  .sp-masthead {
    display: grid;
    grid-template-columns: 104px 1fr 104px;
    align-items: center;
    min-height: 92px;
    padding: 8px 24px;
    border: 1px solid var(--sp-line);
    border-bottom: 4px solid var(--sp-ink);
    background: var(--sp-paper);
    text-align: center;
  }
  .sp-seal {
    display: grid;
    width: 62px;
    height: 62px;
    place-items: center;
    justify-self: center;
    border: 2px solid #8b969d;
    border-radius: 50%;
    color: var(--sp-ink);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .07em;
    line-height: 1.2;
  }
  .sp-masthead h1 {
    margin: 0;
    color: var(--sp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 25px;
    font-weight: 600;
    letter-spacing: .025em;
    line-height: 1.15;
    text-transform: uppercase;
  }
  .sp-masthead p { margin: 5px 0 0; color: #555e65; font-size: 12px; }
  .sp-preview-chip {
    justify-self: center;
    padding: 5px 7px;
    border: 1px solid #b3262d;
    color: #a2262c;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .09em;
    transform: rotate(-5deg);
  }
  .sp-crumb {
    margin: 13px 2px 9px;
    color: #58636c;
    font-size: 12px;
  }
  .sp-crumb span { color: var(--sp-blue); font-weight: 700; }
  .sp-sheet {
    border: 1px solid var(--sp-line);
    background: var(--sp-paper);
    box-shadow: 0 2px 4px rgb(20 35 47 / 8%);
  }
  .sp-sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 17px 21px 14px;
    border-bottom: 1px solid var(--sp-line);
  }
  .sp-sheet-head h2 {
    margin: 0;
    color: var(--sp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: .015em;
    line-height: 1.2;
  }
  .sp-sheet-head p { margin: 4px 0 0; color: var(--sp-muted); font-size: 12px; }
  .sp-record-tag {
    flex: 0 0 auto;
    padding: 5px 8px;
    border: 1px solid #c9d0d5;
    background: #f4f6f7;
    color: #49545d;
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
  }
  .sp-fiction-note {
    margin: 14px 21px 0;
    padding: 8px 10px;
    border-left: 3px solid #a2262c;
    background: #fbf3f2;
    color: #71292b;
    font-size: 11px;
    font-weight: 700;
  }
  .sp-facts {
    display: grid;
    grid-template-columns: 1.1fr .7fr 1.2fr 1.2fr;
    gap: 0;
    margin: 14px 21px 17px;
    border: 1px solid var(--sp-line);
  }
  .sp-fact { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--sp-line); }
  .sp-fact:last-child { border-right: 0; }
  .sp-label {
    display: block;
    margin-bottom: 3px;
    color: #626e77;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .11em;
    text-transform: uppercase;
  }
  .sp-fact strong { display: block; overflow-wrap: anywhere; color: #263d51; font-size: 12px; }
  .sp-section-title {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 21px;
    padding: 9px 0 7px;
    border-top: 1px solid var(--sp-line);
    color: var(--sp-ink);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .sp-section-title span {
    display: grid;
    width: 21px;
    height: 21px;
    place-items: center;
    border-radius: 50%;
    background: #e7edf1;
    color: var(--sp-ink);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10px;
  }
  .sp-paperwork {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0 21px 15px;
  }
  .sp-paperwork-item {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid #d3d9dd;
    background: #fafbfb;
    color: #354653;
    font-size: 11px;
    font-weight: 600;
  }
  .sp-paperwork-item b {
    display: grid;
    width: 19px;
    height: 19px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid #8d9ba4;
    border-radius: 50%;
    color: #17603e;
    font-size: 11px;
  }
  .sp-action-area {
    margin: 0 21px 20px;
    border: 1px solid #b8c4cc;
    background: #f3f6f8;
  }
  .sp-action-head {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 13px;
    border-bottom: 1px solid #cbd4da;
    color: var(--sp-ink);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .sp-action-head i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #b47a19;
    box-shadow: 0 0 0 3px #f4e8ca;
  }
  .sp-action-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 20px;
    padding: 14px;
  }
  .sp-sync-row { display: flex; align-items: center; gap: 9px; color: #293f51; font-size: 12px; font-weight: 700; }
  .sp-sync-row b {
    padding: 3px 7px;
    border: 1px solid #a8c8b6;
    background: #edf6f0;
    color: #286144;
    font-size: 9px;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .sp-sync-copy { margin: 4px 0 0 27px; color: #59656e; font-size: 11px; }
  .sp-sync-copy strong { color: #8d282c; }
  .sp-button-row { display: flex; align-items: center; gap: 9px; }
  .sp-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px 15px;
    border: 1px solid #004575;
    border-radius: 3px;
    background: #00548f;
    color: #fff;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
  }
  .sp-button:hover { background: #064879; }
  .sp-button:focus-visible, .sp-secondary:focus-visible { outline: 3px solid #d69b31; outline-offset: 2px; }
  .sp-button:disabled { cursor: default; opacity: .72; }
  .sp-arrow { font-size: 16px; line-height: 1; }
  .sp-confirmed {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #235b3e;
    font-size: 12px;
    font-weight: 700;
  }
  .sp-confirmed-mark { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: #e2f0e7; }
  .sp-footnote {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    padding: 10px 21px;
    border-top: 1px solid var(--sp-line);
    color: #66717a;
    font-size: 10px;
  }
  .sp-footnote strong { color: #8b2528; letter-spacing: .055em; text-transform: uppercase; }
  .sp-overlay {
    position: fixed;
    z-index: 10;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgb(17 31 44 / 54%);
  }
  .sp-dialog {
    width: min(100%, 530px);
    border: 1px solid #9daab2;
    border-top: 5px solid #00548f;
    background: #fff;
    box-shadow: 0 12px 34px rgb(0 0 0 / 23%);
  }
  .sp-dialog-head { padding: 18px 21px 12px; border-bottom: 1px solid #d4dade; }
  .sp-dialog-kicker { margin: 0 0 4px; color: #5c6871; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .sp-dialog h2 { margin: 0; color: var(--sp-ink); font-family: "Oswald", "Arial Narrow", Arial, sans-serif; font-size: 23px; line-height: 1.2; }
  .sp-dialog-content { padding: 15px 21px 5px; }
  .sp-dialog-content p { margin: 0 0 12px; color: #454f57; font-size: 13px; }
  .sp-seal-warning {
    padding: 11px 12px;
    border: 1px solid #dfc989;
    border-left: 4px solid #a87b1d;
    background: #fff9e9;
    color: #544522;
    font-size: 12px;
    font-weight: 600;
  }
  .sp-dialog-route { margin-top: 11px !important; color: #34495b !important; font-size: 12px !important; }
  .sp-dialog-route strong { color: #17324d; }
  .sp-dialog-actions { display: flex; justify-content: flex-end; gap: 9px; padding: 13px 21px 19px; }
  .sp-secondary {
    min-height: 42px;
    padding: 8px 14px;
    border: 1px solid #8c989f;
    border-radius: 3px;
    background: #fff;
    color: #263d51;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: 700;
  }
  .sp-secondary:hover { background: #f2f4f5; }
  .sp-dialog-preview { border-color: #862329; background: #a42b32; }
  .sp-dialog-preview:hover { background: #87252b; }
  @media (max-width: 700px) {
    .submission-preview { padding: 12px; }
    .sp-masthead { grid-template-columns: 60px 1fr 60px; padding-inline: 8px; }
    .sp-seal { width: 46px; height: 46px; font-size: 7px; }
    .sp-masthead h1 { font-size: 18px; }
    .sp-masthead p { font-size: 10px; }
    .sp-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-fact:nth-child(2) { border-right: 0; }
    .sp-fact:nth-child(-n+2) { border-bottom: 1px solid var(--sp-line); }
    .sp-paperwork { grid-template-columns: 1fr; }
    .sp-action-body { grid-template-columns: 1fr; }
    .sp-button-row { justify-content: flex-start; }
    .sp-sheet-head { padding-inline: 14px; }
    .sp-facts, .sp-fiction-note, .sp-section-title, .sp-paperwork, .sp-action-area { margin-left: 14px; margin-right: 14px; }
    .sp-footnote { padding-inline: 14px; flex-direction: column; }
  }
  @media (max-width: 440px) {
    .sp-preview-banner { align-items: flex-start; flex-direction: column; gap: 3px; }
    .sp-sheet-head { flex-direction: column; }
    .sp-button-row { align-items: stretch; flex-direction: column; }
    .sp-button { width: 100%; }
    .sp-dialog-actions { flex-direction: column-reverse; }
    .sp-dialog-actions button { width: 100%; }
  }
`;

export default function SubmissionControlPreview() {
  const [state, setState] = useState<PreviewState>("draft");

  return (
    <main className="submission-preview">
      <style>{styles}</style>
      <div className="sp-frame">
        <div className="sp-preview-banner">
          <span>Standalone concept preview · no production connection</span>
          <strong>Fictional sample record — no real submission occurs</strong>
        </div>

        <header className="sp-masthead">
          <div className="sp-seal" aria-hidden="true">CITY OF<br />COLUMBUS</div>
          <div>
            <h1>Columbus Division of Police</h1>
            <p>Field Training Officer Portal · Daily Paperwork</p>
          </div>
          <div className="sp-preview-chip">PREVIEW<br />ONLY</div>
        </header>

        <div className="sp-crumb">Field Training <span>/</span> Daily paperwork <span>/</span> Daily log</div>

        <section className="sp-sheet" aria-labelledby="sp-page-title">
          <div className="sp-sheet-head">
            <div>
              <h2 id="sp-page-title">Daily Training Log</h2>
              <p>Review the packet status before sending it to the assigned Coordinator.</p>
            </div>
            <div className="sp-record-tag">SAMPLE · DTL-26-0417</div>
          </div>

          <div className="sp-fiction-note" role="note">
            FICTIONAL TRAINING DATA — Names, identifiers, date, and packet shown here are invented for this preview.
          </div>

          <div className="sp-facts" aria-label="Fictional packet details">
            <div className="sp-fact"><span className="sp-label">Probationary officer</span><strong>Jordan Example · PO-0000</strong></div>
            <div className="sp-fact"><span className="sp-label">Training date</span><strong>04/17/2026</strong></div>
            <div className="sp-fact"><span className="sp-label">Field training officer</span><strong>Officer Casey Sample · 0000</strong></div>
            <div className="sp-fact"><span className="sp-label">Assigned Coordinator</span><strong>Coordinator Riley Demo</strong></div>
          </div>

          <div className="sp-section-title"><span>1</span> Packet review context</div>
          <div className="sp-paperwork" aria-label="Fictional packet contents">
            <div className="sp-paperwork-item"><b aria-hidden="true">✓</b> Daily evaluation saved as draft</div>
            <div className="sp-paperwork-item"><b aria-hidden="true">✓</b> Shift narrative included</div>
            <div className="sp-paperwork-item"><b aria-hidden="true">✓</b> Run forms saved to packet</div>
          </div>

          <div className="sp-section-title"><span>2</span> Draft sync and final submission</div>
          <div className="sp-action-area">
            <div className="sp-action-head"><i aria-hidden="true" /> Submission control · draft has not been submitted</div>
            <div className="sp-action-body">
              <div>
                <div className="sp-sync-row">
                  <span aria-hidden="true">↻</span>
                  <span>Draft sync</span>
                  <b>Saved in workspace</b>
                </div>
                <p className="sp-sync-copy">
                  Sync keeps editable draft changes saved. <strong>Syncing alone never submits or finalizes this packet.</strong>
                </p>
              </div>
              <div className="sp-button-row">
                {state === "preview-confirmed" ? (
                  <div className="sp-confirmed" role="status">
                    <span className="sp-confirmed-mark" aria-hidden="true">✓</span>
                    Preview confirmation recorded locally only.
                  </div>
                ) : (
                  <button className="sp-button" type="button" onClick={() => setState("confirm")}>
                    Finalize and Submit to Coordinator <span className="sp-arrow" aria-hidden="true">›</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="sp-footnote">
            <span><strong>Draft · editable</strong> &nbsp; No official submission is recorded in this preview.</span>
            <span>Sample packet only · local interaction · no network activity</span>
          </div>
        </section>
      </div>

      {state === "confirm" && (
        <div className="sp-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setState("draft");
        }}>
          <section
            className="sp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-confirm-title"
            aria-describedby="sp-confirm-description"
          >
            <div className="sp-dialog-head">
              <p className="sp-dialog-kicker">Final submission · confirm destination</p>
              <h2 id="sp-confirm-title">Finalize this daily packet?</h2>
            </div>
            <div className="sp-dialog-content" id="sp-confirm-description">
              <p>This action is separate from draft sync. A finalized packet is no longer an editable saved draft.</p>
              <div className="sp-seal-warning">
                After submission, the packet is sealed. Corrections would require the established Coordinator process.
              </div>
              <p className="sp-dialog-route">This packet goes <strong>only to its assigned Coordinator, Riley Demo</strong>.</p>
              <p className="sp-dialog-route"><strong>Preview only:</strong> confirming below changes this screen locally. It does not submit, transmit, or seal a real record.</p>
            </div>
            <div className="sp-dialog-actions">
              <button className="sp-secondary" type="button" onClick={() => setState("draft")}>Cancel — keep as draft</button>
              <button className="sp-button sp-dialog-preview" type="button" onClick={() => setState("preview-confirmed")}>
                Confirm in Preview Only
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
