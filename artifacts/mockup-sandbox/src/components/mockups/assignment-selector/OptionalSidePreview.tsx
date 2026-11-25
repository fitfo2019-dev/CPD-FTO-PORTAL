import { useState } from "react";
import "./_group.css";

// Approval-only fixtures. No production contracts, account, CAD, or storage
// imports: accepting a value here cannot change the portal or saved records.
const choices = {
  "C-Co": ["150C", "150C1", "150C2", "158C", "158C1", "158C2", "80C", "80C-1", "80C-2"],
  DMW: ["9150D", "9150D1", "9150D2", "9151D", "9151D1", "9151D2", "80C", "80C-1", "80C-2"],
  EMW: ["9150E", "9150E1", "9150E2", "9151E", "9151E1", "9151E2", "80C", "80C-1", "80C-2"],
} as const;

/** Small isolated approval form using the portal's existing visual treatment. */
export function OptionalSidePreview() {
  const [shift, setShift] = useState<keyof typeof choices>("EMW");
  const [assignment, setAssignment] = useState("9150E");
  const [token, setToken] = useState("9150E");
  const [saved, setSaved] = useState("");
  const valid = /^[0-9]{4}[A-Z](?:-[12])?$/.test(token);
  const side = valid ? token.split("-")[1] : undefined;
  const inputClass = "mt-2 h-10 w-full rounded border bg-card px-3 text-sm font-mono";
  return <main className="universal-assignment-preview min-h-screen p-6 text-sm">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between border-b pb-4">
        <div><p className="font-bold tracking-widest">CITY OF COLUMBUS</p>
          <p>Division of Police · Field Training</p></div>
        <strong className="border px-3 py-2 text-xs">FICTIONAL PREVIEW · NOT INTEGRATED</strong>
      </header>
      <h1 className="text-2xl font-bold">Assignments without required sides</h1>
      <section className="rounded border bg-card">
        <h2 className="border-b bg-muted px-4 py-3 font-bold">Patrol area &amp; FTO assignment</h2>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="font-semibold">Zone<input readOnly value="3" className={inputClass}/></label>
          <label className="font-semibold">Precinct<input readOnly value="15" className={inputClass}/></label>
          <label className="font-semibold">Shift / Company
            <select value={shift} className={inputClass} onChange={event => {
              const next = event.target.value as keyof typeof choices;
              setShift(next); setAssignment(choices[next][0]); setSaved("");
            }}>{Object.keys(choices).map(value => <option key={value}>{value}</option>)}</select>
          </label>
          <label className="font-semibold">FTO assignment
            <select value={assignment} className={inputClass} onChange={event => setAssignment(event.target.value)}>
              {choices[shift].map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <p className="px-4 pb-4 text-muted-foreground">
          Selected: <strong className="font-mono">{assignment}</strong> · Mapped district remains {shift === "C-Co" ? "150" : "9150"} for universal choices.
          {" "}Try C-Co for the unsided wagon 158C. Universal 80C remains available across supported shifts.
        </p>
      </section>
      <section className="rounded border bg-card">
        <h2 className="border-b bg-muted px-4 py-3 font-bold">Account Settings · Operational identity</h2>
        <form className="space-y-4 p-4" onSubmit={event => {
          event.preventDefault();
          if (valid) setSaved(`Preview accepted ${token}. No account was changed.`);
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="font-bold">Signed account role · read only</p>
              <p className="mt-2 font-bold">FTO · Field Training Officer</p>
              <p className="mt-1 text-xs text-muted-foreground">Fictional account · This form cannot change roles or badges.</p></div>
            <label className="font-bold">Operational assignment token
              <input value={token} maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                className={inputClass} aria-invalid={!valid} onChange={event => { setToken(event.target.value); setSaved(""); }}/>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Four digits and an uppercase shift letter; optional side -1 or -2. Examples: 9150E, 9150E-1, 9150E-2.</span>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border bg-muted/30 p-3"><strong>Physical cruiser · read only</strong><output className="ml-3 font-mono font-bold">Not supplied</output></div>
            <div className="rounded border bg-muted/30 p-3"><strong>CAD identifier · read only</strong><output className="ml-3 font-mono font-bold">{valid ? token : "—"}</output></div>
          </div>
          <p role="status">{valid
            ? `Valid · District token ${token.slice(0, 4)} · Shift letter ${token[4]} · Side ${side ?? "absent (not defaulted)"}`
            : "Invalid · Use four digits, an uppercase letter, and optional -1 or -2."}</p>
          <p className="border-l-4 border-primary bg-primary/5 p-3"><strong>Future packets only.</strong> CAD district digits are not a physical fleet number. Exact full-unit matching is required; 9150E does not match 9150E-1 or 9150E-2. Existing packets, selected patrol geography, and manual Cruiser corrections stay unchanged.</p>
          <button disabled={!valid} className="inline-flex h-10 items-center rounded bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">Save assignment</button>
          {saved && <p role="status">{saved}</p>}
        </form>
      </section>
      <p className="text-xs text-muted-foreground">Approval scope: add unsided choices and optional-side validation, preserve the current form grids and styling, and distinguish CAD district tokens from physical fleet numbers. This preview has no live CAD connection.</p>
    </div>
  </main>;
}
