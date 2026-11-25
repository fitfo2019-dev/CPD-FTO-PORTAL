import { useState } from "react";

const styles = `
  .shell-caps-preview {
    --scp-ink: #17324d;
    --scp-blue: #00548f;
    --scp-red: #b3262d;
    --scp-muted: #5c6670;
    --scp-line: #c9d0d5;
    min-height: 100dvh;
    padding: 22px 28px;
    background: #e9ecee;
    color: #41484e;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .shell-caps-preview * { box-sizing: border-box; }
  .scp-frame { width: min(100%, 1120px); margin: 0 auto; }
  .scp-preview-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 14px;
    padding: 8px 11px;
    border: 1px solid #d7b573;
    background: #fff8e9;
    color: #654b1f;
    font-size: 11px;
    font-weight: 700;
  }
  .scp-preview-note strong {
    color: #8b2528;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .scp-shell {
    border: 1px solid var(--scp-line);
    border-top: 4px solid var(--scp-ink);
    background: #fff;
    box-shadow: 0 2px 4px rgb(20 35 47 / 8%);
  }
  .scp-brandline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 15px 20px 13px;
    border-bottom: 1px solid var(--scp-line);
  }
  .scp-brand {
    color: var(--scp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: .025em;
    line-height: 1.25;
    text-transform: uppercase;
  }
  .scp-shell-caption {
    margin-top: 2px;
    color: var(--scp-muted);
    font-size: 11px;
  }
  .scp-profile-link {
    color: var(--scp-blue);
    font-size: 12px;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .scp-shell-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 0 12px;
    border-bottom: 1px solid var(--scp-line);
    background: #f5f7f8;
  }
  .scp-shell-nav a {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    padding: 0 12px;
    border-bottom: 3px solid transparent;
    color: #3e4e5a;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .035em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .scp-shell-nav a:hover, .scp-shell-nav a:focus-visible {
    border-bottom-color: var(--scp-blue);
    color: var(--scp-blue);
  }
  .scp-shell-nav a:focus-visible, .scp-profile-link:focus-visible,
  .scp-action:focus-visible, .scp-field:focus-visible {
    outline: 3px solid #d69b31;
    outline-offset: 2px;
  }
  .scp-content { padding: 20px; }
  .scp-kicker {
    margin: 0 0 6px;
    color: var(--scp-blue);
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .11em;
    text-transform: uppercase;
  }
  .scp-dashboard-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 15px;
  }
  .scp-dashboard-heading h1 {
    margin: 0;
    color: var(--scp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 25px;
    font-weight: 600;
    letter-spacing: .015em;
    line-height: 1.15;
  }
  .scp-dashboard-heading p { margin: 4px 0 0; color: var(--scp-muted); font-size: 12px; }
  .scp-settings-header {
    margin: 0;
    color: var(--scp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: .045em;
    text-transform: uppercase;
  }
  .scp-action-row { display: flex; flex-wrap: wrap; gap: 9px; }
  .scp-action {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    padding: 8px 13px;
    border: 1px solid #004575;
    border-radius: 3px;
    background: var(--scp-blue);
    color: #fff;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .035em;
    text-align: center;
    text-transform: uppercase;
  }
  .scp-action:hover { background: #064879; }
  .scp-action-secondary {
    border-color: #9aa7af;
    background: #fff;
    color: var(--scp-ink);
  }
  .scp-action-secondary:hover { background: #f1f4f5; }
  .scp-action-finalize { border-color: #862329; background: #a42b32; }
  .scp-action-finalize:hover { background: #87252b; }
  .scp-section {
    margin-top: 15px;
    border: 1px solid var(--scp-line);
    background: #fff;
  }
  .scp-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--scp-line);
    background: #f7f8f9;
  }
  .scp-section-head h2 {
    margin: 0;
    color: var(--scp-ink);
    font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: .035em;
    text-transform: uppercase;
  }
  .scp-section-head span {
    color: #67737c;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .scp-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 14px; }
  .scp-label {
    display: block;
    margin-bottom: 5px;
    color: #3e4c56;
    font-size: 11px;
    font-weight: 700;
  }
  .scp-field {
    width: 100%;
    min-height: 40px;
    border: 1px solid #9ca9b0;
    border-radius: 2px;
    padding: 8px 10px;
    background: #fff;
    color: #333d44;
    font-family: Arial, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    text-transform: none;
  }
  .scp-field:focus-visible { outline-offset: 1px; }
  .scp-field::placeholder { color: #77828a; opacity: 1; }
  .scp-input-note { margin: 5px 0 0; color: #66717a; font-size: 10px; }
  .scp-field-excerpt {
    margin: 0 14px 14px;
    padding: 10px 12px;
    border-left: 3px solid #7b8790;
    background: #f3f5f6;
    color: #4d5962;
    font-size: 11px;
  }
  .scp-field-excerpt strong { color: #2e4354; }
  .scp-field-excerpt code {
    color: #17324d;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
  }
  .scp-local-message {
    min-height: 20px;
    margin: 9px 0 0;
    color: #5b6670;
    font-size: 10px;
  }
  .scp-bottomline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--scp-line);
    color: #66717a;
    font-size: 10px;
  }
  .scp-bottomline strong { color: #8b2528; text-transform: uppercase; }
  @media (max-width: 700px) {
    .shell-caps-preview { padding: 12px; }
    .scp-brandline { align-items: flex-start; flex-direction: column; padding-inline: 14px; }
    .scp-shell-nav { padding: 0 6px; }
    .scp-shell-nav a { min-height: 38px; padding-inline: 8px; font-size: 10px; }
    .scp-content { padding: 14px; }
    .scp-dashboard-heading { align-items: flex-start; flex-direction: column; }
    .scp-controls { grid-template-columns: 1fr; }
    .scp-bottomline { align-items: flex-start; flex-direction: column; }
  }
`;

export default function ShellCapitalizationPreview() {
  const [narrative, setNarrative] = useState("Arrived at McKinley Ave");
  const [cadReference, setCadReference] = useState("AbC-123");
  const [notice, setNotice] = useState("");

  const keepPreviewLocal = (label: string) => {
    setNotice(`${label} — style preview only; no records were loaded, saved, submitted, or changed.`);
  };

  return (
    <main className="shell-caps-preview">
      <style>{styles}</style>
      <div className="scp-frame">
        <div className="scp-preview-note">
          <span>Isolated typography and capitalization preview</span>
          <strong>No records are loaded or saved</strong>
        </div>

        <section className="scp-shell" aria-label="Portal shell capitalization sample">
          <header className="scp-brandline">
            <div>
              <div className="scp-brand">Columbus Division of Police</div>
              <div className="scp-shell-caption">Field Training Officer Portal</div>
            </div>
            <a className="scp-profile-link" href="#profile-example">My Profile</a>
          </header>

          <nav className="scp-shell-nav" aria-label="Portal navigation example">
            <a href="#dashboard-example">Dashboard</a>
            <a href="#forms-example">Daily Reports</a>
            <a href="#forms-example">Weekly Packets</a>
            <a href="#settings-example">Settings</a>
          </nav>

          <div className="scp-content" id="dashboard-example">
            <div className="scp-dashboard-heading">
              <div>
                <p className="scp-kicker">Shell presentation sample</p>
                <h1>Dashboard</h1>
                <p>Uppercase presentation is limited to shell navigation and action controls.</p>
              </div>
              <h2 className="scp-settings-header" id="settings-example">Settings</h2>
            </div>

            <div className="scp-action-row" aria-label="Dashboard action button examples">
              <button className="scp-action" type="button" onClick={() => keepPreviewLocal("Save Local Draft")}>
                Save Local Draft
              </button>
              <button className="scp-action scp-action-finalize" type="button" onClick={() => keepPreviewLocal("Finalize and Submit to Coordinator")}>
                Finalize and Submit to Coordinator
              </button>
              <a className="scp-profile-link" href="#profile-example" id="profile-example">View Profile</a>
            </div>
            <p className="scp-local-message" role="status" aria-live="polite">{notice}</p>

            <section className="scp-section" id="forms-example" aria-labelledby="scp-form-title">
              <div className="scp-section-head">
                <h2 id="scp-form-title">Protected form-field excerpt</h2>
                <span>Input casing examples</span>
              </div>
              <div className="scp-controls">
                <div>
                  <label className="scp-label" htmlFor="scp-narrative">Narrative example</label>
                  <textarea
                    className="scp-field"
                    id="scp-narrative"
                    rows={2}
                    value={narrative}
                    onChange={(event) => setNarrative(event.target.value)}
                    spellCheck={false}
                  />
                  <p className="scp-input-note">Editable sample · original typed casing is retained.</p>
                </div>
                <div>
                  <label className="scp-label" htmlFor="scp-cad">CAD reference example</label>
                  <input
                    className="scp-field"
                    id="scp-cad"
                    type="text"
                    value={cadReference}
                    onChange={(event) => setCadReference(event.target.value)}
                    spellCheck={false}
                  />
                  <p className="scp-input-note">Input value is not uppercased or transformed.</p>
                </div>
              </div>
              <div className="scp-field-excerpt">
                <strong>INPUT CASING EXAMPLES</strong> &nbsp; Narrative: <code>Arrived at McKinley Ave</code>
                &nbsp; · &nbsp; CAD: <code>AbC-123</code> &nbsp; · &nbsp; Charge: <code>ORC 4511.21</code>
                <br />CSS text transformation applies only to the shell controls above, never to form content.
              </div>
            </section>

            <div className="scp-bottomline">
              <span><strong>Preview only</strong> · sample strings are not records or operational data.</span>
              <span>Form edits remain in this page’s local memory only.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
