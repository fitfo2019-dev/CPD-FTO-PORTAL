import { useState, type SubmitEvent } from "react";
import { AlertCircle, CheckCircle2, Info, Save, ShieldCheck } from "lucide-react";

type OperationalRole = "FTO" | "PO";
type Profile = { role: OperationalRole; assignmentToken: string };

const isOperationalAssignment = (value: string) => /^\d{4}[A-Z]-[12]$/.test(value);

export default function CruiserIdentityPreview() {
  const [profile, setProfile] = useState<Profile>({ role: "FTO", assignmentToken: "9150E-1" });
  const [savedProfile, setSavedProfile] = useState<Profile>({ role: "FTO", assignmentToken: "9150E-1" });
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"saved" | "error" | null>(null);

  const assignmentIsValid = isOperationalAssignment(profile.assignmentToken);
  const assignmentError = attemptedSave && !assignmentIsValid
    ? "Enter four digits, one uppercase company letter, a hyphen, and side 1 or 2. Example: 9150E-1."
    : "";
  const hasChanges = profile.role !== savedProfile.role || profile.assignmentToken !== savedProfile.assignmentToken;

  const updateProfile = (updates: Partial<Profile>) => {
    setProfile((current) => ({ ...current, ...updates }));
    setSaveMessage(null);
  };

  const saveProfile = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSave(true);
    setSaveMessage(null);
    if (!assignmentIsValid || saving) {
      setSaveMessage("error");
      return;
    }

    setSaving(true);
    window.setTimeout(() => {
      setSavedProfile({ ...profile });
      setSaving(false);
      setSaveMessage("saved");
    }, 350);
  };

  return (
    <main className="identity-preview">
      <style>{`
        .identity-preview {
          --identity-page: #eef1f4;
          --identity-ink: #1d2937;
          --identity-muted: #59636f;
          --identity-line: #cdd4dc;
          --identity-navy: #102c4d;
          --identity-blue: #154c7a;
          --identity-red: #c92535;
          --identity-paper: #fff;
          --identity-note: #fff5df;
          min-height: 100dvh;
          background: var(--identity-page);
          color: var(--identity-ink);
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }
        .identity-preview, .identity-preview * { box-sizing: border-box; }
        .identity-preview button, .identity-preview input, .identity-preview select { font: inherit; }
        .identity-preview button { cursor: pointer; }
        .identity-preview__preview-note {
          border-top: 3px solid var(--identity-red);
          background: var(--identity-note);
          color: #4b3911;
          padding: 8px 16px;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .025em;
        }
        .identity-preview__masthead { background: var(--identity-navy); color: #fff; }
        .identity-preview__masthead-inner {
          width: min(100% - 32px, 1180px);
          margin: 0 auto;
          padding: 20px 0 18px;
          text-align: center;
        }
        .identity-preview__division {
          color: rgb(255 255 255 / 85%);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .identity-preview__masthead h1 {
          margin: 4px 0 0;
          font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
          font-size: clamp(20px, 4vw, 27px);
          font-weight: 600;
          letter-spacing: .015em;
          line-height: 1.2;
        }
        .identity-preview__crumbbar { border-bottom: 1px solid #d7dce2; background: var(--identity-paper); }
        .identity-preview__crumbbar-inner {
          display: flex;
          width: min(100% - 32px, 1180px);
          min-height: 46px;
          margin: 0 auto;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--identity-muted);
          font-size: 13px;
        }
        .identity-preview__crumb { color: var(--identity-blue); font-weight: 700; }
        .identity-preview__crumb-divider { padding: 0 8px; color: #8a949e; }
        .identity-preview__preview-label {
          color: var(--identity-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-align: right;
          text-transform: uppercase;
        }
        .identity-preview__content {
          width: min(100% - 32px, 920px);
          margin: 0 auto;
          padding: 30px 0 48px;
        }
        .identity-preview__heading { margin-bottom: 20px; }
        .identity-preview__kicker {
          color: var(--identity-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .15em;
          text-transform: uppercase;
        }
        .identity-preview__heading h2 {
          margin: 4px 0 5px;
          font-family: "Oswald", "Arial Narrow", Arial, sans-serif;
          font-size: clamp(25px, 4vw, 32px);
          font-weight: 600;
          letter-spacing: .015em;
          line-height: 1.2;
        }
        .identity-preview__heading p { max-width: 66ch; margin: 0; color: var(--identity-muted); }
        .identity-preview__panel {
          overflow: hidden;
          border: 1px solid var(--identity-line);
          border-radius: 4px;
          background: var(--identity-paper);
          box-shadow: 0 1px 2px rgb(16 44 77 / 6%);
        }
        .identity-preview__panel-head {
          border-bottom: 1px solid #dce1e6;
          padding: 12px 20px;
          color: #4f5b66;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .identity-preview__form { padding: 20px; }
        .identity-preview__fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 20px; }
        .identity-preview__field { display: grid; align-content: start; gap: 7px; min-width: 0; }
        .identity-preview__field label,
        .identity-preview__field legend {
          padding: 0;
          color: #4f5b66;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .identity-preview__field select,
        .identity-preview__field input {
          width: 100%;
          min-height: 44px;
          border: 1px solid #aeb9c4;
          border-radius: 3px;
          background: #fff;
          color: var(--identity-ink);
          padding: 9px 12px;
        }
        .identity-preview__field input {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: .035em;
        }
        .identity-preview__field select:focus-visible,
        .identity-preview__field input:focus-visible {
          outline: 3px solid #154c7a;
          outline-offset: 2px;
          border-color: #154c7a;
        }
        .identity-preview__field input[aria-invalid="true"] { border-color: #a62331; }
        .identity-preview__hint { margin: 0; color: var(--identity-muted); font-size: 12px; }
        .identity-preview__quick-options { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
        .identity-preview__option {
          min-height: 36px;
          border: 1px solid #cbd2da;
          border-radius: 3px;
          background: #fff;
          color: #344557;
          padding: 6px 10px;
          font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
          font-size: 12px !important;
          font-weight: 700;
        }
        .identity-preview__option[aria-pressed="true"] {
          border-color: var(--identity-blue);
          background: #edf3f8;
          color: var(--identity-blue);
          box-shadow: inset 0 0 0 1px var(--identity-blue);
        }
        .identity-preview__read-only { margin-top: 22px; }
        .identity-preview__read-only-title {
          margin: 0 0 9px;
          color: #4f5b66;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .identity-preview__read-only-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .identity-preview__read-only-item {
          display: flex;
          min-height: 65px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #d7dce2;
          background: #f5f6f7;
          padding: 11px 13px;
        }
        .identity-preview__read-only-item span { color: var(--identity-muted); font-size: 12px; }
        .identity-preview__read-only-item strong {
          color: #24384b;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 16px;
          letter-spacing: .04em;
        }
        .identity-preview__boundary {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          border-left: 4px solid var(--identity-blue);
          background: #edf3f8;
          padding: 13px 14px;
          color: #34495d;
          font-size: 13px;
          line-height: 1.55;
        }
        .identity-preview__boundary svg { flex: 0 0 auto; margin-top: 2px; color: var(--identity-blue); }
        .identity-preview__boundary strong { color: #23384c; }
        .identity-preview__error,
        .identity-preview__save-state {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 13px;
          font-size: 13px;
        }
        .identity-preview__error { color: #8d1f2b; }
        .identity-preview__save-state { color: #215f42; }
        .identity-preview__error svg,
        .identity-preview__save-state svg { flex: 0 0 auto; margin-top: 2px; }
        .identity-preview__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 20px;
          border-top: 1px solid #dce1e6;
          padding-top: 17px;
        }
        .identity-preview__dirty {
          color: var(--identity-muted);
          font-size: 12px;
          font-weight: 600;
        }
        .identity-preview__save {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--identity-navy);
          border-radius: 3px;
          background: var(--identity-navy);
          color: white;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 700;
        }
        .identity-preview__save:hover:not(:disabled) { background: #193c61; }
        .identity-preview__save:focus-visible,
        .identity-preview__option:focus-visible { outline: 3px solid #154c7a; outline-offset: 2px; }
        .identity-preview__save:disabled { cursor: wait; opacity: .72; }
        .identity-preview__disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 15px;
          border: 1px solid #d7c99f;
          border-radius: 3px;
          background: #fff8e8;
          padding: 12px 14px;
          color: #51462c;
          font-size: 12px;
          line-height: 1.5;
        }
        .identity-preview__disclaimer svg { flex: 0 0 auto; margin-top: 1px; color: #735b1c; }
        @media (max-width: 639px) {
          .identity-preview__preview-note { padding-inline: 10px; }
          .identity-preview__masthead-inner { width: min(100% - 24px, 1180px); padding: 17px 0; }
          .identity-preview__crumbbar-inner { width: min(100% - 24px, 1180px); align-items: flex-start; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 0; }
          .identity-preview__preview-label { text-align: left; }
          .identity-preview__content { width: min(100% - 24px, 920px); padding-top: 23px; }
          .identity-preview__form { padding: 16px; }
          .identity-preview__fields { grid-template-columns: 1fr; gap: 16px; }
          .identity-preview__read-only-grid { grid-template-columns: 1fr; }
          .identity-preview__actions { align-items: stretch; flex-direction: column; }
          .identity-preview__save { width: 100%; }
        }
      `}</style>

      <div className="identity-preview__preview-note" data-testid="text-preview-notice">
        FICTIONAL ACCOUNT SETTINGS PREVIEW · Memory only · No real account save
      </div>
      <header className="identity-preview__masthead">
        <div className="identity-preview__masthead-inner">
          <div className="identity-preview__division">Division of Police</div>
          <h1>Columbus FTO Portal</h1>
        </div>
      </header>
      <div className="identity-preview__crumbbar">
        <div className="identity-preview__crumbbar-inner">
          <div>
            <span className="identity-preview__crumb">Account</span>
            <span className="identity-preview__crumb-divider" aria-hidden="true">/</span>
            <span>Settings</span>
          </div>
          <span className="identity-preview__preview-label">Isolated interface preview · Fictional data</span>
        </div>
      </div>

      <section className="identity-preview__content" aria-labelledby="identity-settings-title">
        <div className="identity-preview__heading">
          <div className="identity-preview__kicker">Account settings</div>
          <h2 id="identity-settings-title">Operational identity</h2>
          <p>Review the role and assignment details that will be included with future training packets.</p>
        </div>

        <section className="identity-preview__panel" aria-labelledby="identity-profile-title">
          <div className="identity-preview__panel-head" id="identity-profile-title">Profile and assignment</div>
          <form className="identity-preview__form" onSubmit={saveProfile} noValidate>
            <div className="identity-preview__fields">
              <div className="identity-preview__field">
                <label htmlFor="identity-role">Portal role</label>
                <select
                  id="identity-role"
                  value={profile.role}
                  disabled={saving}
                  onChange={(event) => updateProfile({ role: event.target.value as OperationalRole })}
                  data-testid="select-operational-role"
                >
                  <option value="FTO">FTO · Field Training Officer</option>
                  <option value="PO">PO · Probationary Officer</option>
                </select>
                <p className="identity-preview__hint">Choose the role for this fictional account preview.</p>
              </div>

              <div className="identity-preview__field">
                <label htmlFor="identity-assignment">Operational assignment token</label>
                <input
                  id="identity-assignment"
                  type="text"
                  value={profile.assignmentToken}
                  disabled={saving}
                  onChange={(event) => updateProfile({ assignmentToken: event.target.value })}
                  maxLength={7}
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(assignmentError)}
                  aria-describedby={assignmentError ? "identity-assignment-hint identity-assignment-error" : "identity-assignment-hint"}
                  data-testid="input-operational-assignment"
                />
                <p className="identity-preview__hint" id="identity-assignment-hint">
                  Format: four digits, uppercase company letter, hyphen, then side 1 or 2.
                </p>
                <div className="identity-preview__quick-options" aria-label="Example assignment tokens">
                  {(["9150E-1", "9150E-2"] as const).map((token) => (
                    <button
                      className="identity-preview__option"
                      type="button"
                      key={token}
                      disabled={saving}
                      aria-pressed={profile.assignmentToken === token}
                      onClick={() => updateProfile({ assignmentToken: token })}
                      data-testid={`button-assignment-${token.slice(-1)}`}
                    >
                      Use {token}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {assignmentError && (
              <div className="identity-preview__error" id="identity-assignment-error" role="alert" data-testid="text-assignment-error">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{assignmentError}</span>
              </div>
            )}
            {saveMessage === "error" && !assignmentError && (
              <div className="identity-preview__error" role="alert" data-testid="text-save-error">
                <AlertCircle size={16} aria-hidden="true" />
                <span>The preview could not apply these settings. Review the assignment token and try again.</span>
              </div>
            )}
            {saveMessage === "saved" && (
              <div className="identity-preview__save-state" role="status" data-testid="text-save-success">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Preview settings saved in memory. No account or packet records were changed.</span>
              </div>
            )}

            <div className="identity-preview__read-only">
              <h3 className="identity-preview__read-only-title">Reference identifiers · read only</h3>
              <div className="identity-preview__read-only-grid">
                <div className="identity-preview__read-only-item" data-testid="text-physical-cruiser">
                  <span>Physical cruiser</span>
                  <strong>9150</strong>
                </div>
                <div className="identity-preview__read-only-item" data-testid="text-cad-identifier">
                  <span>CAD identifier</span>
                  <strong>9150E</strong>
                </div>
              </div>
            </div>

            <div className="identity-preview__boundary" role="note" data-testid="text-future-packets-only">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                <strong>Future packets only.</strong> A saved assignment applies only to packets created later.
                This role selector changes fictional preview data only; signed account roles cannot be edited.
                A PO profile never replaces the FTO vehicle context.
              </span>
            </div>

            <div className="identity-preview__actions">
              <span className="identity-preview__dirty" data-testid="text-profile-state">
                {saving ? "Applying preview settings…" : hasChanges ? "Unsaved preview changes" : "Preview values are current"}
              </span>
              <button className="identity-preview__save" type="submit" disabled={saving} data-testid="button-save-operational-profile">
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving preview…" : "Save preview settings"}
              </button>
            </div>
          </form>
        </section>

        <div className="identity-preview__disclaimer" role="note" data-testid="text-memory-only">
          <Info size={16} aria-hidden="true" />
          <span>
            This is an isolated, fictional preview. Changes are simulated in page memory only; nothing is sent to a
            server or stored in the browser. Refreshing clears all edits. This does not save a real account.
          </span>
        </div>
      </section>
    </main>
  );
}
