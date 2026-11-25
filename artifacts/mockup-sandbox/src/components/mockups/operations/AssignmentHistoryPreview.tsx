import { useState, type CSSProperties } from "react";
import { tokens } from "@workspace/fto-law-library-schema/tokens";
import { EmptyState } from "@workspace/fto-law-library-schema/components/library";
import "@workspace/fto-law-library-schema/styles.css";
import "@workspace/fto-law-library-schema/library.css";
import "./assignment-history-preview.css";

type PreviewState = "history" | "empty" | "loading" | "error";

const entries = [
  { version: 4, old: "9150E-1", next: "9150E", at: "2026-11-25T06:10:00Z", label: "Assignment changed", actor: "Your verified account" },
  { version: 3, old: "9150E-2", next: "9150E-1", at: "2026-11-24T21:32:18Z", label: "Assignment changed", actor: "Your verified account" },
  { version: 2, old: null, next: "9150E-2", at: "2026-11-23T13:05:00Z", label: "History tracking started", actor: "Agency migration" },
];

export default function AssignmentHistoryPreview() {
  const [state, setState] = useState<PreviewState>("history");
  const [older, setOlder] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const color = tokens.color.light;
  const theme = {
    "--history-primary": color.primary,
    "--history-background": color.background,
    "--history-card": color.card,
    "--history-foreground": color.foreground,
    "--history-muted": color.mutedForeground,
    "--history-border": color.border,
    "--history-secondary": color.secondary,
    "--history-error": color.destructive,
    "--history-radius": tokens.radius,
    "--history-space": tokens.spacing,
    "--history-mono": tokens.fontFamily.mono.join(", "),
    fontFamily: tokens.fontFamily.sans.join(", "),
  } as CSSProperties;
  return <main className="fls-scope assignment-history-preview" style={theme}>
    <div className="history-preview-toolbar">
      <span>Fictional preview · Account Settings</span>
      <label>Preview state <select value={state} onChange={event => { setState(event.target.value as PreviewState); setRefreshed(false); }}>
        <option value="history">Saved history</option>
        <option value="empty">No saved assignment</option>
        <option value="loading">Loading</option>
        <option value="error">Connection unavailable</option>
      </select></label>
    </div>
    <div className="history-preview-content">
      <header><p className="history-eyebrow">Account Settings</p><h1>Operational identity</h1></header>
      <section className="history-preview-card" aria-labelledby="current-assignment-title">
        <h2 id="current-assignment-title">Current assignment</h2>
        <div className="history-current">
          <strong>{state === "empty" ? "Not assigned" : "9150E"}</strong>
          <span>{state === "empty" ? "No assignment saved" : "Version 4"}</span>
        </div>
      </section>
      <section className="history-preview-card" aria-labelledby="assignment-history-title">
        <div className="history-section-heading">
          <div><p className="history-eyebrow">Own account</p><h2 id="assignment-history-title">Assignment history</h2></div>
          <button disabled={state === "loading"} onClick={() => { setState("history"); setRefreshed(true); }}>Refresh history</button>
        </div>
        {state === "loading" && <p role="status">Loading assignment history…</p>}
        {state === "error" && <div role="alert" className="history-error">
          <p>Assignment history could not be loaded. Check your connection and try again.</p>
          <button onClick={() => setState("history")}>Retry history</button>
        </div>}
        {state === "empty" && <EmptyState title="No assignment history yet" description="No operational assignment has been saved for your account." />}
        {state === "history" && <>
          <ol className="history-entry-list">
            {entries.slice(0, older ? 3 : 2).map(entry => <li key={entry.version}>
              <div className="history-entry-heading"><h3>{entry.label}</h3><span>Version {entry.version}</span></div>
              <p className="history-transition"><span>{entry.old ?? "Not recorded"}</span><span aria-label="changed to">→</span><strong>{entry.next}</strong></p>
              <dl className="history-entry-details">
                <div><dt>Recorded</dt><dd><time dateTime={entry.at}>{new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium", timeStyle: "long", timeZone: "America/New_York",
                }).format(new Date(entry.at))}</time></dd></div>
                <div><dt>Actor</dt><dd>{entry.actor}</dd></div>
              </dl>
              {entry.old === null && <p className="history-boundary">Earlier assignments are not recorded. This entry marks the start of history tracking, not the original assignment date.</p>}
            </li>)}
          </ol>
          {!older && <button onClick={() => setOlder(true)}>Load older history</button>}
          {older && <p className="history-boundary">Start of recorded history</p>}
          {refreshed && <p role="status">History refreshed.</p>}
        </>}
      </section>
    </div>
  </main>;
}
