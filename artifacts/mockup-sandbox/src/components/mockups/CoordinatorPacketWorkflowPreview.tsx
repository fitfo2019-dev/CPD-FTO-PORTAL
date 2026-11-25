import { useState } from "react";

const styles = `
  .cpw-preview {
    --cpw-ink: #17324d;
    --cpw-blue: #00548f;
    --cpw-red: #b3262d;
    --cpw-red-dark: #84232a;
    --cpw-muted: #5c6670;
    --cpw-line: #c9d0d5;
    min-height: 100dvh;
    padding: 18px 24px 24px;
    background: #e9ecee;
    color: #41484e;
    font-family: Arial, sans-serif;
    font-size: 13px;
    line-height: 1.45;
  }
  .cpw-preview * { box-sizing: border-box; }
  .cpw-frame { width: min(100%, 1160px); margin: 0 auto; }
  .cpw-preview-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding: 7px 10px;
    border: 1px solid #d7b573;
    background: #fff8e9;
    color: #654b1f;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .035em;
  }
  .cpw-preview-banner strong {
    color: var(--cpw-red-dark);
    font-size: 10px;
    letter-spacing: .07em;
    text-transform: uppercase;
  }
  .cpw-shell {
    border: 1px solid var(--cpw-line);
    border-top: 4px solid var(--cpw-ink);
    background: #fff;
    box-shadow: 0 2px 4px rgb(20 35 47 / 8%);
  }
  .cpw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 17px;
    border-bottom: 1px solid var(--cpw-line);
  }
  .cpw-brand {
    color: var(--cpw-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: .025em;
    line-height: 1.15;
    text-transform: uppercase;
  }
  .cpw-header-sub { margin-top: 3px; color: var(--cpw-muted); font-size: 10px; }
  .cpw-shell-label {
    color: var(--cpw-blue);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .09em;
    text-transform: uppercase;
  }
  .cpw-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 0 8px;
    border-bottom: 1px solid var(--cpw-line);
    background: #f5f7f8;
  }
  .cpw-nav span {
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    padding: 0 10px;
    color: #3e4e5a;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .045em;
    text-transform: uppercase;
  }
  .cpw-main { padding: 15px 17px 16px; }
  .cpw-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
  }
  .cpw-eyebrow {
    margin: 0 0 3px;
    color: var(--cpw-blue);
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .09em;
    text-transform: uppercase;
  }
  .cpw-heading h1 {
    margin: 0;
    color: var(--cpw-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: .015em;
    line-height: 1.15;
  }
  .cpw-heading-note {
    max-width: 350px;
    margin: 0;
    color: var(--cpw-muted);
    font-size: 10px;
    text-align: right;
  }
  .cpw-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.07fr) minmax(0, .93fr);
    gap: 11px;
    align-items: start;
  }
  .cpw-column { display: grid; gap: 10px; min-width: 0; }
  .cpw-panel {
    min-width: 0;
    border: 1px solid var(--cpw-line);
    background: #fff;
  }
  .cpw-panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 11px;
    border-bottom: 1px solid var(--cpw-line);
    background: #f6f7f8;
  }
  .cpw-panel-heading h2 {
    margin: 0;
    color: var(--cpw-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .035em;
    text-transform: uppercase;
  }
  .cpw-panel-heading small {
    color: #67737c;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 8px;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .cpw-panel-body { padding: 10px 11px; }
  .cpw-setup-copy { margin: 0 0 8px; color: #4c5861; font-size: 10px; }
  .cpw-field-label {
    display: block;
    margin-bottom: 4px;
    color: #3e4c56;
    font-size: 10px;
    font-weight: 700;
  }
  .cpw-select, .cpw-textarea {
    width: 100%;
    min-height: 34px;
    border: 1px solid #9ca9b0;
    border-radius: 2px;
    padding: 6px 8px;
    background: #fff;
    color: #333d44;
    font-family: Arial, sans-serif;
    font-size: 11px;
  }
  .cpw-select:focus-visible, .cpw-textarea:focus-visible, .cpw-button:focus-visible {
    outline: 3px solid #d69b31;
    outline-offset: 2px;
  }
  .cpw-select option { color: #333d44; }
  .cpw-setup-foot {
    margin: 6px 0 0;
    color: #5d6871;
    font-size: 9px;
  }
  .cpw-setup-foot strong { color: var(--cpw-red-dark); }
  .cpw-empty {
    padding: 12px 10px;
    border: 1px dashed #bac3c9;
    background: #fafbfb;
    color: #58646d;
    font-size: 10px;
    text-align: center;
  }
  .cpw-empty strong { display: block; margin-bottom: 2px; color: var(--cpw-ink); }
  .cpw-inbox-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 8px;
  }
  .cpw-button {
    min-height: 33px;
    padding: 7px 10px;
    border: 1px solid #9aa7af;
    border-radius: 2px;
    background: #fff;
    color: var(--cpw-ink);
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .045em;
    text-transform: uppercase;
  }
  .cpw-button:hover:not(:disabled) { background: #f1f4f5; }
  .cpw-button:disabled { cursor: not-allowed; opacity: .56; }
  .cpw-button-red {
    border-color: var(--cpw-red-dark);
    background: var(--cpw-red);
    color: #fff;
  }
  .cpw-button-red:hover:not(:disabled) { background: var(--cpw-red-dark); }
  .cpw-popup {
    border: 2px solid #8b242b;
    background: #fff;
    box-shadow: 0 2px 8px rgb(40 20 21 / 14%);
  }
  .cpw-popup-top {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 12px 9px;
    background: #a62931;
    color: #fff;
  }
  .cpw-popup-mark {
    display: grid;
    width: 25px;
    height: 25px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 65%);
    border-radius: 50%;
    font-size: 16px;
    font-weight: 700;
  }
  .cpw-popup-top h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .015em;
  }
  .cpw-popup-content { padding: 11px 12px; }
  .cpw-popup-message {
    margin: 0 0 5px;
    color: #2d3840;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
  }
  .cpw-popup-copy { margin: 0; color: #505c64; font-size: 10px; }
  .cpw-popup-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    border-top: 1px solid #e2c2c4;
    background: #fbf2f2;
  }
  .cpw-signout {
    border: 0;
    padding: 5px 2px;
    background: transparent;
    color: #5b3436;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 9px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .cpw-signout:focus-visible { outline: 3px solid #d69b31; outline-offset: 2px; }
  .cpw-flow-list { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .cpw-flow-label {
    padding: 5px 7px;
    border: 1px solid #aab5bc;
    background: #f5f7f8;
    color: #314759;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .045em;
    text-align: center;
  }
  .cpw-flow-label:last-of-type { border-color: #9bb5a4; background: #eff5f1; color: #315b43; }
  .cpw-flow-arrow { color: #74818a; font-size: 11px; }
  .cpw-branch {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #d8dde0;
    color: #5b656d;
    font-size: 9px;
  }
  .cpw-branch strong { padding: 4px 6px; border: 1px solid #d5a8aa; background: #fbefef; color: #8a252b; font-size: 8px; letter-spacing: .04em; }
  .cpw-rules {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
    padding: 9px 11px 10px;
  }
  .cpw-rule {
    position: relative;
    padding-left: 10px;
    color: #4e5a63;
    font-size: 9px;
  }
  .cpw-rule::before {
    position: absolute;
    top: 5px;
    left: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--cpw-blue);
    content: "";
  }
  .cpw-rule strong { color: #263d51; }
  .cpw-correction { padding: 9px 11px 10px; border-top: 1px solid var(--cpw-line); }
  .cpw-correction-label { display: block; margin-bottom: 4px; color: #3e4c56; font-size: 9px; font-weight: 700; }
  .cpw-textarea { min-height: 47px; resize: vertical; }
  .cpw-correction-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .cpw-correction-note { margin: 0; color: #67727a; font-size: 8px; }
  .cpw-local-note {
    min-height: 15px;
    margin: 6px 0 0;
    color: #59656e;
    font-size: 9px;
  }
  .cpw-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--cpw-line);
    color: #65717a;
    font-size: 9px;
  }
  .cpw-footer strong { color: var(--cpw-red-dark); letter-spacing: .045em; text-transform: uppercase; }
  @media (max-width: 760px) {
    .cpw-preview { padding: 11px; }
    .cpw-grid { grid-template-columns: 1fr; }
    .cpw-heading { align-items: flex-start; flex-direction: column; }
    .cpw-heading-note { text-align: left; }
  }
  @media (max-width: 520px) {
    .cpw-preview-banner, .cpw-header, .cpw-footer { align-items: flex-start; flex-direction: column; }
    .cpw-main { padding: 12px; }
    .cpw-rules { grid-template-columns: 1fr; }
    .cpw-popup-bottom { align-items: flex-start; flex-direction: column; }
    .cpw-flow-label { font-size: 7px; }
  }
`;

export default function CoordinatorPacketWorkflowPreview() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [localNote, setLocalNote] = useState("");

  const acknowledgeLocally = () => {
    setAcknowledged(true);
    setLocalNote("Local preview interaction only — no receipt was recorded and no packet was approved.");
  };

  return (
    <main className="cpw-preview">
      <style>{styles}</style>
      <div className="cpw-frame">
        <div className="cpw-preview-banner">
          <span>Isolated workflow preview · proposed controls only</span>
          <strong>No operational records loaded or saved</strong>
        </div>

        <section className="cpw-shell" aria-label="Coordinator packet workflow preview">
          <header className="cpw-header">
            <div>
              <div className="cpw-brand">Columbus Division of Police</div>
              <div className="cpw-header-sub">Field Training Officer Portal</div>
            </div>
            <div className="cpw-shell-label">Submission workflow concept</div>
          </header>
          <nav className="cpw-nav" aria-label="Portal shell sample">
            <span>Dashboard</span>
            <span>Daily Reports</span>
            <span>Packet Submission Inbox</span>
            <span>Settings</span>
          </nav>

          <div className="cpw-main">
            <div className="cpw-heading">
              <div>
                <p className="cpw-eyebrow">Workflow controls · no records</p>
                <h1>Coordinator packet submission</h1>
              </div>
              <p className="cpw-heading-note">Status labels below describe the proposed flow; they are not actual packet statuses.</p>
            </div>

            <div className="cpw-grid">
              <div className="cpw-column">
                <section className="cpw-panel" aria-labelledby="cpw-setup-title">
                  <div className="cpw-panel-heading">
                    <h2 id="cpw-setup-title">Assigned Coordinator</h2>
                    <small>Required before submit</small>
                  </div>
                  <div className="cpw-panel-body">
                    <p className="cpw-setup-copy">At sign-up, the PO selects an assigned Coordinator from the actual Coordinator directory. An authorized FTO Coordinator can later edit that assignment.</p>
                    <label className="cpw-field-label" htmlFor="cpw-coordinator">Coordinator directory</label>
                    <select className="cpw-select" id="cpw-coordinator" defaultValue="">
                      <option value="">Select from Coordinator directory</option>
                    </select>
                    <p className="cpw-setup-foot"><strong>Submission blocked</strong> until an assigned Coordinator is selected. The actual role and roster determine the recipient.</p>
                  </div>
                </section>

                <section className="cpw-panel" aria-labelledby="cpw-inbox-title">
                  <div className="cpw-panel-heading">
                    <h2 id="cpw-inbox-title">Packet Submission Inbox</h2>
                    <small>Coordinator view</small>
                  </div>
                  <div className="cpw-panel-body">
                    <div className="cpw-empty">
                      <strong>Inbox empty state</strong>
                      No packet content or operational records are loaded in this preview.
                    </div>
                    <div className="cpw-inbox-actions" aria-label="Proposed Coordinator review actions">
                      <button className="cpw-button" type="button" disabled>Review packet</button>
                      <button className="cpw-button cpw-button-red" type="button" disabled>Approve packet</button>
                      <button className="cpw-button" type="button" disabled>Return for correction</button>
                    </div>
                    <p className="cpw-local-note">Review/approve and correction actions are shown as control structure only; unavailable without an actual assigned packet.</p>
                  </div>
                </section>
              </div>

              <div className="cpw-column">
                <section className="cpw-popup" aria-labelledby="cpw-popup-title">
                  <div className="cpw-popup-top">
                    <span className="cpw-popup-mark" aria-hidden="true">!</span>
                    <h2 id="cpw-popup-title">Proposed required acknowledgment popup</h2>
                  </div>
                  <div className="cpw-popup-content" role="alert">
                    <p className="cpw-popup-message">New packet submission. A packet has been submitted to your inbox for review. Acknowledge receipt to continue.</p>
                    <p className="cpw-popup-copy">Acknowledging does not approve the packet. Proposed gate: Coordinator acknowledges before continuing site use.</p>
                  </div>
                  <div className="cpw-popup-bottom">
                    <button className="cpw-signout" type="button" onClick={() => setLocalNote("Sign-out escape is part of the proposed flow; this preview does not sign out or contact a server.")}>
                      Sign out
                    </button>
                    <button className="cpw-button cpw-button-red" type="button" aria-pressed={acknowledged} onClick={acknowledgeLocally}>
                      Acknowledge Packet
                    </button>
                  </div>
                  {localNote && <p className="cpw-local-note" role="status" aria-live="polite">{localNote}</p>}
                </section>

                <section className="cpw-panel" aria-labelledby="cpw-fto-title">
                  <div className="cpw-panel-heading">
                    <h2 id="cpw-fto-title">FTO status flow</h2>
                    <small>Flow labels only</small>
                  </div>
                  <div className="cpw-panel-body">
                    <div className="cpw-flow-list" aria-label="Submitted then packet acknowledge then complete">
                      <span className="cpw-flow-label">SUBMITTED</span>
                      <span className="cpw-flow-arrow" aria-hidden="true">→</span>
                      <span className="cpw-flow-label">PACKET ACKNOWLEDGE</span>
                      <span className="cpw-flow-arrow" aria-hidden="true">→</span>
                      <span className="cpw-flow-label">COMPLETE</span>
                    </div>
                    <div className="cpw-branch">
                      Correction branch <span aria-hidden="true">→</span> <strong>CORRECTION REQUESTED</strong>
                    </div>
                    <div className="cpw-rules">
                      <div className="cpw-rule">Receipt acknowledgment is <strong>not approval</strong>.</div>
                      <div className="cpw-rule"><strong>Complete</strong> only after Coordinator review and approval.</div>
                      <div className="cpw-rule">Corrections require a reason and resubmission.</div>
                      <div className="cpw-rule">Resubmitted packet is acknowledged again.</div>
                      <div className="cpw-rule">Status and acknowledgment gate must persist across accounts/devices.</div>
                      <div className="cpw-rule">Actual role and Coordinator roster determine inbox recipient.</div>
                    </div>
                    <div className="cpw-correction">
                      <label className="cpw-correction-label" htmlFor="cpw-correction-reason">Coordinator correction reason · required before returning a packet</label>
                      <textarea
                        className="cpw-textarea"
                        id="cpw-correction-reason"
                        value={correctionReason}
                        onChange={(event) => setCorrectionReason(event.target.value)}
                        placeholder="Coordinator describes the changes needed before returning the packet."
                      />
                      <div className="cpw-correction-row">
                        <p className="cpw-correction-note">Preview only. No resubmission occurs.</p>
                        <button
                          className="cpw-button"
                          type="button"
                          disabled={!correctionReason.trim()}
                          onClick={() => setLocalNote("Correction reason entered in local preview only; no packet was returned.")}
                        >
                          Return for correction
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="cpw-footer">
              <span><strong>Preview-only interaction</strong> · acknowledge/sign-out/resubmit controls do not make server calls.</span>
              <span>No persistence, inbox delivery, approval, or real submission is simulated.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
