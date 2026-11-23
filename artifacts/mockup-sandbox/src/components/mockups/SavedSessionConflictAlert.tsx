import { useState } from "react";
import { AlertTriangle, Clock3, Monitor, ShieldCheck, X } from "lucide-react";

export function SavedSessionConflictAlert() {
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [message, setMessage] = useState("");

  const navy = "#15324f";
  const muted = "#596878";
  const border = "#d6dde4";

  return (
    <main style={{
      minHeight: "100vh",
      background: "#edf1f4",
      color: "#172a3a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "Arial, sans-serif",
    }}>
      <section style={{
        width: "100%",
        maxWidth: 510,
        background: "#fff",
        border: `1px solid ${border}`,
        boxShadow: "0 12px 32px rgba(17, 37, 58, .12)",
      }}>
        <header style={{
          height: 52,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: navy,
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".08em",
        }}>
          <span>FIELD TRAINING WORKSPACE</span>
          <span style={{ opacity: 0.82 }}>LOCAL VAULT OPEN</span>
        </header>

        <div style={{ padding: 22 }}>
          <div style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            border: "1px solid #e3b95c",
            borderLeft: "5px solid #c78913",
            background: "#fff8e8",
            padding: 16,
          }} role="alert">
            <AlertTriangle size={22} color="#8a5a00" aria-hidden="true" />
            <div>
              <div style={{ fontSize: 17, lineHeight: 1.3, fontWeight: 700, color: "#382b14" }}>
                Two sessions have unsaved changes
              </div>
              <p style={{ margin: "7px 0 0", color: "#4f4534", fontSize: 14, lineHeight: 1.5 }}>
                A second tab has edits that haven’t been saved. Saving from this tab could replace its draft.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 19 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".08em",
              color: muted,
              textTransform: "uppercase",
              marginBottom: 8,
            }}>
              Open sessions
            </div>
            <SessionRow label="This tab" detail="Unsaved changes" current navy={navy} border={border} />
            <SessionRow label="Second tab" detail="Unsaved changes · 2 minutes ago" border={border} />
          </div>

          {message && (
            <div role="status" style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 9,
              color: "#245b3b",
              background: "#eff8f1",
              border: "1px solid #b8d9c2",
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.4,
            }}>
              <ShieldCheck size={17} aria-hidden="true" />
              {message}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setMessage("No changes were overwritten. Both tabs remain open.")}
              style={secondaryButton}
            >
              Keep both tabs open
            </button>
            <button
              type="button"
              onClick={() => { setMessage(""); setConfirmingOverwrite(true); }}
              style={dangerButton}
            >
              Overwrite other tab
            </button>
          </div>

          <p style={{
            margin: "13px 0 0",
            color: muted,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            Overwriting replaces the other tab’s unsaved changes. It can’t be undone.
          </p>
        </div>

        {confirmingOverwrite && (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 20,
              background: "rgba(11, 24, 37, .55)",
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="overwrite-title"
              style={{
                width: "100%",
                maxWidth: 390,
                background: "#fff",
                borderTop: "5px solid #a52a2a",
                padding: 22,
                boxShadow: "0 16px 48px rgba(0,0,0,.28)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <h2 id="overwrite-title" style={{ margin: 0, color: "#182b3d", fontSize: 19 }}>
                  Overwrite the other session?
                </h2>
                <button
                  type="button"
                  aria-label="Close confirmation"
                  onClick={() => setConfirmingOverwrite(false)}
                  style={{ border: 0, background: "transparent", padding: 2, color: muted, cursor: "pointer" }}
                >
                  <X size={19} />
                </button>
              </div>
              <p style={{ color: "#435364", fontSize: 14, lineHeight: 1.55, margin: "12px 0 20px" }}>
                This replaces the second tab’s unsaved edits with this tab’s version. The other changes can’t be recovered.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setConfirmingOverwrite(false)} style={secondaryButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingOverwrite(false);
                    setMessage("Preview only — no workspace changes were overwritten.");
                  }}
                  style={dangerButton}
                >
                  Yes, overwrite other tab
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function SessionRow({
  label,
  detail,
  current = false,
  navy = "#15324f",
  border = "#d6dde4",
}: {
  label: string;
  detail: string;
  current?: boolean;
  navy?: string;
  border?: string;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 11,
      minHeight: 60,
      padding: "10px 12px",
      border: `1px solid ${border}`,
      borderBottom: 0,
      background: current ? "#f5f8fb" : "#fff",
    }}>
      <Monitor size={18} color={navy} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3448" }}>{label}</div>
        <div style={{ marginTop: 3, fontSize: 12, color: "#596878" }}>{detail}</div>
      </div>
      {current ? (
        <span style={{
          color: "#17456b",
          background: "#e6eff7",
          fontSize: 10,
          fontWeight: 700,
          padding: "4px 6px",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>Current</span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#596878", fontSize: 11, whiteSpace: "nowrap" }}>
          <Clock3 size={13} aria-hidden="true" /> Active
        </span>
      )}
    </div>
  );
}

const secondaryButton = {
  minHeight: 40,
  border: "1px solid #9aa8b5",
  background: "#fff",
  color: "#18334d",
  padding: "0 13px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const dangerButton = {
  minHeight: 40,
  border: "1px solid #8d2525",
  background: "#a52a2a",
  color: "#fff",
  padding: "0 13px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;
