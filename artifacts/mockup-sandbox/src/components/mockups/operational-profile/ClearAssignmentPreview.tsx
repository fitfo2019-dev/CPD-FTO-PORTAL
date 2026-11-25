import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { tokens } from "@workspace/fto-law-library-schema/tokens";
import "./_clear-assignment.css";

const INITIAL_ASSIGNMENT = "9150E-1";
const VALID_ASSIGNMENT = /^\d{4}[A-Z](?:-[12])?$/;

const previewTheme: CSSProperties = {
  "--op-background": tokens.color.light.background,
  "--op-foreground": tokens.color.light.foreground,
  "--op-card": tokens.color.light.card,
  "--op-card-foreground": tokens.color.light.cardForeground,
  "--op-primary": tokens.color.light.primary,
  "--op-primary-foreground": tokens.color.light.primaryForeground,
  "--op-secondary": tokens.color.light.secondary,
  "--op-secondary-foreground": tokens.color.light.secondaryForeground,
  "--op-muted": tokens.color.light.muted,
  "--op-muted-foreground": tokens.color.light.mutedForeground,
  "--op-border": tokens.color.light.border,
  "--op-input": tokens.color.light.input,
  "--op-destructive": tokens.color.light.destructive,
  "--op-destructive-foreground": tokens.color.light.destructiveForeground,
  "--op-font-sans": tokens.fontFamily.sans.join(", "),
  "--op-font-heading": tokens.fontFamily.heading.join(", "),
  "--op-font-mono": tokens.fontFamily.mono.join(", "),
  "--op-radius": tokens.radius,
  "--op-spacing": tokens.spacing,
} as CSSProperties;

export function ClearAssignmentPreview() {
  const [token, setToken] = useState(INITIAL_ASSIGNMENT);
  const [savedToken, setSavedToken] = useState<string | null>(INITIAL_ASSIGNMENT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const dirty = token !== (savedToken ?? "");
  const hasSavedIdentity = savedToken !== null;
  const valid = VALID_ASSIGNMENT.test(token);
  const cadUnit = valid ? token.replace(/-[12]$/, "") : "";

  useEffect(() => {
    if (!dialogOpen) return;

    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".op-dialog button:not(:disabled), .op-dialog input:not(:disabled)",
        ),
      );
      if (controls.length < 2) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen]);

  function closeDialog() {
    setDialogOpen(false);
    setConfirmed(false);
    requestAnimationFrame(() => clearButtonRef.current?.focus());
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!valid) {
      setError("Use four district digits, an uppercase shift letter, and optional side -1 or -2, for example 9150E or 9150E-1.");
      return;
    }
    setSavedToken(token);
    setMessage("Assignment saved. It will apply to future packets only.");
  }

  function reloadSavedAssignment() {
    setToken(savedToken ?? "");
    setError("");
    setMessage(savedToken ? "Saved assignment reloaded." : "No saved vehicle assignment is on file.");
  }

  function confirmClear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || !hasSavedIdentity || dirty) return;
    setSavedToken(null);
    setToken("");
    setError("");
    setMessage("No vehicle assigned. Future packets will use manual vehicle entry.");
    closeDialog();
  }

  const canClear = hasSavedIdentity && !dirty;

  return (
    <main className="op-preview" style={previewTheme}>
      <section className="op-frame" aria-labelledby="op-page-title">
        <header className="op-page-header">
          <div>
            <p className="op-eyebrow">Columbus Field Training</p>
            <h1 id="op-page-title" className="op-heading">Account Settings</h1>
          </div>
          <p className="op-preview-note">Fictional preview · Changes stay on this screen</p>
        </header>

        <section className="op-panel" aria-labelledby="op-panel-title">
          <div className="op-panel-heading">
            <div>
              <h2 id="op-panel-title" className="op-heading">Account Settings · Operational Identity</h2>
              <p className="op-panel-subtitle">Manage the vehicle assignment used for future packets.</p>
            </div>
            <p className={`op-assignment-state${hasSavedIdentity ? "" : " is-empty"}`} role="status">
              {hasSavedIdentity ? `Assignment saved · ${savedToken}` : "No vehicle assigned"}
            </p>
          </div>

          <form className="op-form" onSubmit={handleSave} noValidate>
            <div className="op-grid">
              <div className="op-field">
                <span className="op-label">Signed account role · read only</span>
                <p className="op-role" data-testid="text-profile-role">FTO · Field Training Officer</p>
                <p className="op-help">Badge 04817 · This form cannot change roles or badges.</p>
              </div>
              <div className="op-field">
                <label className="op-label" htmlFor="op-assignment-token">Operational assignment token</label>
                <input
                  id="op-assignment-token"
                  className="op-input op-mono"
                  value={token}
                  maxLength={7}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(error) || (dirty && !valid)}
                  aria-describedby="op-assignment-help"
                  onChange={(event) => {
                    setToken(event.target.value);
                    setError("");
                    setMessage("");
                  }}
                />
                <p className="op-help" id="op-assignment-help">
                  Four district digits and an uppercase shift letter; optional side -1 or -2. Examples: 9150E, 9150E-1, 9150E-2.
                </p>
              </div>
            </div>

            <div className="op-grid op-readouts">
              <div className="op-readout">
                <span className="op-label">Physical cruiser · read only</span>
                <output className="op-readout-value op-mono">Not supplied</output>
              </div>
              <div className="op-readout">
                <span className="op-label">CAD identifier · read only</span>
                <output className="op-readout-value op-mono" aria-label={cadUnit ? `CAD identifier ${cadUnit}` : "No CAD identifier"}>
                  {cadUnit}
                </output>
              </div>
            </div>

            <p className="op-policy">
              <strong>Future packets only.</strong> Saving changes your account&apos;s operational assignment, not your training roster, role, badge or record access. Existing packets and manual Cruiser corrections stay unchanged. A PO profile never replaces the FTO vehicle context.
            </p>

            {dirty && <p className="op-status" role="status">Unsaved changes. Save or reload the saved assignment before clearing it.</p>}
            {error && <p className="op-error" role="alert">{error}</p>}
            {message && <p className="op-status" role="status">{message}</p>}

            <div className="op-actions">
              <button className="op-button op-button-primary" type="submit" disabled={!dirty || !valid}>
                Save assignment
              </button>
              <button className="op-button op-button-secondary" type="button" onClick={reloadSavedAssignment}>
                {dirty ? "Discard edits and reload" : "Reload saved assignment"}
              </button>
              <button
                ref={clearButtonRef}
                className="op-button op-button-danger"
                type="button"
                disabled={!canClear}
                onClick={() => {
                  setConfirmed(false);
                  setDialogOpen(true);
                }}
              >
                Clear assignment
              </button>
            </div>
          </form>
        </section>
      </section>

      {dialogOpen && (
        <div className="op-dialog-backdrop">
          <section
            className="op-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="op-dialog-title"
            aria-describedby="op-dialog-description"
          >
            <p className="op-eyebrow">Confirm account change</p>
            <h2 id="op-dialog-title" className="op-heading">Clear operational assignment?</h2>
            <p id="op-dialog-description" className="op-dialog-copy">
              Only the current operational vehicle assignment will be cleared. Your account, training assignment, and saved packets remain unchanged. Future packets will use manual vehicle entry.
            </p>
            <form className="op-confirm-form" onSubmit={confirmClear}>
              <label className="op-confirm-label" htmlFor="op-confirm-no-vehicle">
                <input
                  id="op-confirm-no-vehicle"
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>I have no vehicle currently assigned</span>
              </label>
              <div className="op-dialog-actions">
                <button ref={cancelRef} className="op-button op-button-secondary" type="button" onClick={closeDialog}>
                  Cancel
                </button>
                <button
                  id="clear-assignment-confirm"
                  className="op-button op-button-danger"
                  type="submit"
                  disabled={!confirmed}
                >
                  Confirm clear assignment
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default ClearAssignmentPreview;
