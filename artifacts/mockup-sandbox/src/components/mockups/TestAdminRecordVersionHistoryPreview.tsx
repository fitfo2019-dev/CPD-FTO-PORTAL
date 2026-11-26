import { History, ShieldCheck, X } from "lucide-react";
import { tokens } from "@workspace/fto-law-library-schema/tokens";

const palette = tokens.color.light;
const type = tokens.fontFamily;
const spacing = tokens.spacing;

const pill = (background: string, color: string) => ({
  borderRadius: tokens.radius,
  padding: `${spacing} ${spacing}`,
  background,
  color,
  fontSize: 12,
  fontWeight: 700,
});

export default function TestAdminRecordVersionHistoryPreview() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "232px minmax(0, 1fr)",
      background: palette.background,
      color: palette.foreground,
      fontFamily: type.sans.join(", "),
    }}>
      <aside style={{
        padding: 24,
        background: palette.sidebar,
        borderRight: `1px solid ${palette.sidebarBorder}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 44 }}>
          <ShieldCheck size={24} color={palette.primary} aria-hidden="true" />
          <div>
            <strong style={{ display: "block", fontFamily: type.heading.join(", "), fontSize: 14 }}>Columbus FTO Portal</strong>
            <span style={{ color: palette.mutedForeground, fontSize: 11 }}>Test Admin · Synthetic staging</span>
          </div>
        </div>
        <p style={{ color: palette.mutedForeground, fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>TRAINING RECORDS</p>
        <div style={{
          marginTop: 14,
          padding: 12,
          borderRadius: tokens.radius,
          background: palette.sidebarAccent,
          color: palette.sidebarAccentForeground,
          fontSize: 13,
          fontWeight: 700,
        }}>Synthetic records</div>
      </aside>

      <section style={{ padding: "38px clamp(20px, 4vw, 56px)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: palette.mutedForeground, fontSize: 12, fontWeight: 700 }}>TEST ADMIN / TRAINING RECORDS</p>
          <h1 style={{ margin: "8px 0 24px", fontFamily: type.heading.join(", "), fontSize: 30 }}>Synthetic record details</h1>

          <article style={{
            overflow: "hidden",
            border: `1px solid ${palette.border}`,
            borderRadius: tokens.radius,
            background: palette.card,
            boxShadow: `0 18px 50px ${palette.foreground}18`,
          }}>
            <header style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 22px",
              borderBottom: `1px solid ${palette.border}`,
            }}>
              <div>
                <p style={{ margin: "0 0 4px", color: palette.mutedForeground, fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>FICTIONAL DATA</p>
                <h2 style={{ margin: 0, fontFamily: type.heading.join(", "), fontSize: 20 }}>Training record · v2</h2>
              </div>
              <button type="button" aria-label="Close preview" style={{ border: 0, background: "transparent", color: palette.mutedForeground }}>
                <X size={20} />
              </button>
            </header>

            <div style={{ display: "grid", gap: 16, padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label style={{ color: palette.mutedForeground, fontSize: 11 }}>PROBATIONARY OFFICER<input readOnly value="Fictional participant" style={inputStyle} /></label>
                <label style={{ color: palette.mutedForeground, fontSize: 11 }}>RECORD DATE<input readOnly value="2026-11-10" style={inputStyle} /></label>
                <label style={{ color: palette.mutedForeground, fontSize: 11 }}>PHASE<input readOnly value="Phase 1" style={inputStyle} /></label>
              </div>

              <section aria-labelledby="version-heading" style={{
                overflow: "hidden",
                border: `1px solid ${palette.border}`,
                borderRadius: tokens.radius,
                background: palette.muted,
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderBottom: `1px solid ${palette.border}`,
                }}>
                  <h3 id="version-heading" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 12, letterSpacing: ".06em" }}>
                    <History size={15} aria-hidden="true" /> SAVED VERSIONS
                  </h3>
                  <span style={{ color: palette.mutedForeground, fontSize: 11 }}>2 versions</span>
                </div>
                <ol style={{ maxHeight: 190, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
                  <li style={{ padding: "13px 14px", background: palette.card, borderBottom: `1px solid ${palette.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 12 }}>Version 1</strong>
                      <span style={pill(palette.muted, palette.mutedForeground)}>Draft</span>
                    </div>
                    <p style={narrativeStyle}>Fictional shift note before correction.</p>
                  </li>
                  <li style={{ padding: "13px 14px", background: palette.card }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 12 }}>Version 2</strong>
                      <span style={pill(palette.secondary, palette.secondaryForeground)}>Submitted</span>
                      <span style={pill(palette.accent, palette.accentForeground)}>Current</span>
                    </div>
                    <p style={narrativeStyle}>Fictional corrected shift note with the saved status shown alongside the version number.</p>
                  </li>
                </ol>
              </section>

              <label style={{ color: palette.foreground, fontSize: 12, fontWeight: 700 }}>
                CURRENT NARRATIVE
                <textarea readOnly value="Fictional corrected shift note with the saved status shown alongside the version number." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" style={secondaryButton}>Cancel</button>
                <button type="button" style={primaryButton}>Save new version</button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "9px 10px",
  border: `1px solid ${palette.input}`,
  borderRadius: tokens.radius,
  background: palette.background,
  color: palette.foreground,
  font: `13px ${type.sans.join(", ")}`,
};

const narrativeStyle = {
  margin: "8px 0 0",
  color: palette.cardForeground,
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap" as const,
};

const secondaryButton = {
  border: `1px solid ${palette.border}`,
  borderRadius: tokens.radius,
  padding: "9px 13px",
  background: palette.card,
  color: palette.foreground,
  font: `700 11px ${type.sans.join(", ")}`,
  textTransform: "uppercase" as const,
};

const primaryButton = {
  border: `1px solid ${palette.primary}`,
  borderRadius: tokens.radius,
  padding: "9px 13px",
  background: palette.primary,
  color: palette.primaryForeground,
  font: `700 11px ${type.sans.join(", ")}`,
  textTransform: "uppercase" as const,
};
