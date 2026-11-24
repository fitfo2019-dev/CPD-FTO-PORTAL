import { useState } from 'react';
import './_group.css';

const geography: Record<string, Record<string, string[]>> = {
  '2': { '9': ['90', '91', '92', '93', '94'], '14': ['140', '141', '142', '143', '144'], '20': ['200', '201', '202', '203', '204'] },
  '3': { '8': ['80', '81', '82', '83', '84'], '10': ['100', '101', '102', '103', '104', '105'], '15': ['150', '151', '152', '153', '154'], '19': ['190', '191', '192', '193', '194'] },
  '4': { '3': ['30', '31', '32', '33', '34'], '4': ['40', '41', '42', '43', '44'], '17': ['170', '171', '172', '173', '174'] },
};
const assignments = [
  { code: '153C', detail: 'Mapped district 153 · C-Co', kind: 'mapped' },
  { code: '153C1', detail: 'Mapped district 153 · C-Co · 1', kind: 'mapped' },
  { code: '153C2', detail: 'Mapped district 153 · C-Co · 2', kind: 'mapped' },
  { code: '158C1', detail: 'Precinct 15 wagon · C-Co · 1', kind: 'mapped' },
  { code: '158C2', detail: 'Precinct 15 wagon · C-Co · 2', kind: 'mapped' },
  { code: '80C-1', detail: 'User-requested option · not established by the SOP', kind: 'requested' },
  { code: '80C-2', detail: 'User-requested option · not established by the SOP', kind: 'requested' },
] as const;

export function UniversalAssignmentPreview() {
  const [assignment, setAssignment] = useState('153C');
  const [district, setDistrict] = useState('153');
  const [zone, setZone] = useState('3');
  const [precinct, setPrecinct] = useState('15');
  const [shift, setShift] = useState('C-Co');

  const updateZone = (value: string) => {
    setZone(value);
    const firstPrecinct = Object.keys(geography[value])[0];
    setPrecinct(firstPrecinct);
    setDistrict(geography[value][firstPrecinct][0]);
  };
  const precinctChoices = geography[zone];
  const districtChoices = precinctChoices[precinct] ?? [];

  return (
    <main className="universal-assignment-preview">
      <div className="ua-shell">
        <header className="ua-masthead">
          <div className="ua-seal" aria-hidden="true"><span>CPD</span></div>
          <div className="ua-brand">
            <p className="ua-city">CITY OF COLUMBUS</p>
            <p className="ua-division">Division of Police <span>·</span> Field Training</p>
          </div>
          <div className="ua-demo-tag">FICTIONAL DEMO</div>
        </header>

        <section className="ua-title-row">
          <div>
            <p className="ua-kicker">STEP 1 <span>/</span> PHASE SETUP</p>
            <h1>Phase setup</h1>
            <p className="ua-intro">Set the patrol area and FTO assignment for this phase.</p>
          </div>
          <div className="ua-phase-mark" aria-label="Phase 1">PHASE <strong>01</strong></div>
        </section>

        <section className="ua-panel" aria-labelledby="assignment-heading">
          <div className="ua-panel-heading">
            <div>
              <p className="ua-overline">ASSIGNMENT DETAILS</p>
              <h2 id="assignment-heading">Patrol area &amp; FTO assignment</h2>
            </div>
            <span className="ua-required"><span aria-hidden="true">*</span> Required fields</span>
          </div>

          <div className="ua-recruit-strip">
            <div><span>Training class</span><strong>136th class</strong></div>
            <div><span>PO name</span><strong>Jordan Reyes</strong></div>
            <div><span>PO badge number</span><strong>7048</strong></div>
          </div>

          <div className="ua-grid">
            <label className="ua-field">
              <span className="ua-label">Patrol zone <b>*</b></span>
              <select value={zone} onChange={event => updateZone(event.target.value)}>
                {Object.keys(geography).map(value => <option key={value} value={value}>Zone {value}</option>)}
              </select>
            </label>
            <label className="ua-field">
              <span className="ua-label">Precinct <b>*</b></span>
              <select value={precinct} onChange={event => {
                const nextPrecinct = event.target.value;
                setPrecinct(nextPrecinct);
                setDistrict(precinctChoices[nextPrecinct][0]);
              }}>
                {Object.keys(precinctChoices).map(value => <option key={value} value={value}>Precinct {value}</option>)}
              </select>
            </label>
            <label className="ua-field">
              <span className="ua-label">Shift / company <b>*</b></span>
              <select value={shift} onChange={event => setShift(event.target.value)}>
                <option value="C-Co">C-Co</option>
                <option value="A-Co">A-Co</option>
                <option value="B-Co">B-Co</option>
                <option value="DMW">DMW</option>
                <option value="EMW">EMW</option>
              </select>
            </label>
          </div>

          <div className="ua-context">
            <div className="ua-context-copy">
              <span className="ua-context-icon" aria-hidden="true">MAP</span>
              <div>
                <span className="ua-label">Mapped cruiser district</span>
                <p>Geographic patrol context stays separate from the assignment code.</p>
              </div>
            </div>
            <label className="ua-district-control">
              <span className="ua-sr-only">Mapped cruiser district context</span>
              <select aria-label="Mapped cruiser district context" value={district} onChange={event => setDistrict(event.target.value)}>
                {districtChoices.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <span className="ua-map-status"><i /> Mapped</span>
            </label>
          </div>

          <fieldset className="ua-assignments">
            <legend className="ua-label">FTO assignment <b>*</b></legend>
            <p className="ua-help">Choose an assignment for {shift}. The mapped district above can be changed independently.</p>
            <div className="ua-choice-grid">
              {assignments.map(option => {
                const selected = assignment === option.code;
                const requested = option.kind === 'requested';
                return (
                  <label key={option.code} className={`ua-choice ${selected ? 'is-selected' : ''} ${requested ? 'is-requested' : ''}`}>
                    <input
                      type="radio"
                      name="fto-assignment"
                      value={option.code}
                      checked={selected}
                      onChange={() => setAssignment(option.code)}
                    />
                    <span className="ua-radio" aria-hidden="true" />
                    <span className="ua-choice-main">
                      <strong>{option.code}</strong>
                      <small>{option.detail}</small>
                    </span>
                    {requested && <span className="ua-user-tag">USER REQUEST</span>}
                    {selected && <span className="ua-selected-tag">SELECTED</span>}
                  </label>
                );
              })}
            </div>
            <div className="ua-caution">
              <span className="ua-caution-mark" aria-hidden="true">!</span>
              <p><strong>Requested universal codes are not confirmed by the SOP.</strong> 80C-1 and 80C-2 are shown here solely as user-requested options. They do not represent a geographic district or change the selected shift or mapped district.</p>
            </div>
          </fieldset>

          <div className="ua-summary" aria-live="polite">
            <div className="ua-summary-head">
              <span className="ua-summary-dot" />
              <strong>Current selection</strong>
              <span className="ua-preview-label">PREVIEW ONLY</span>
            </div>
            <div className="ua-summary-values">
              <div><span>Patrol area</span><strong>Zone {zone} <i>/</i> Precinct {precinct}</strong></div>
              <div><span>Shift / company</span><strong>{shift}</strong></div>
              <div><span>Mapped district</span><strong>{district}</strong></div>
              <div><span>FTO assignment</span><strong className="ua-code">{assignment}</strong></div>
            </div>
          </div>
        </section>

        <footer className="ua-footer">
          <span className="ua-footer-rule" />
          <p>Preview only — this is not a saved phase assignment.</p>
          <span className="ua-footer-meta">FIELD TRAINING <i>•</i> DEMO VIEW</span>
        </footer>
      </div>

      <style>{`
        .ua-shell { width: min(100%, 1000px); margin: 0 auto; padding: 20px clamp(16px, 4vw, 44px) 22px; }
        .ua-masthead { display:flex; align-items:center; gap:12px; min-height:52px; border-bottom:1px solid hsl(var(--border)); padding-bottom:12px; }
        .ua-seal { display:grid; width:38px; height:38px; place-items:center; border:2px solid hsl(var(--primary)); border-radius:50%; color:hsl(var(--primary)); font-family:var(--app-font-display); font-weight:700; font-size:11px; letter-spacing:.04em; }
        .ua-brand { min-width:0; }
        .ua-city,.ua-division { margin:0; line-height:1.2; }
        .ua-city { font-family:var(--app-font-display); font-size:13px; font-weight:700; letter-spacing:.1em; }
        .ua-division { margin-top:3px; color:hsl(var(--muted-foreground)); font-size:11px; }
        .ua-division span { color:hsl(var(--accent)); padding:0 3px; }
        .ua-demo-tag { margin-left:auto; padding:5px 8px; border:1px solid hsl(var(--accent) / .42); color:hsl(var(--accent)); font-size:9px; font-weight:800; letter-spacing:.12em; }
        .ua-title-row { display:flex; align-items:end; justify-content:space-between; gap:18px; padding:19px 0 15px; }
        .ua-kicker,.ua-overline { margin:0 0 4px; color:hsl(var(--primary)); font-size:9px; font-weight:800; letter-spacing:.15em; }
        .ua-kicker span { color:hsl(var(--accent)); padding:0 4px; }
        .ua-title-row h1 { margin:0; font-family:var(--app-font-display); font-size:clamp(28px, 4vw, 36px); font-weight:600; letter-spacing:.01em; line-height:1.05; }
        .ua-intro { margin:6px 0 0; color:hsl(var(--muted-foreground)); font-size:12px; }
        .ua-phase-mark { display:flex; align-items:center; gap:8px; color:hsl(var(--muted-foreground)); font-size:9px; font-weight:800; letter-spacing:.1em; }
        .ua-phase-mark strong { display:grid; width:38px; height:38px; place-items:center; border:1px solid hsl(var(--border)); background:hsl(var(--card)); color:hsl(var(--primary)); font-family:var(--app-font-display); font-size:19px; }
        .ua-panel { border:1px solid hsl(var(--border)); border-top:4px solid hsl(var(--primary)); background:hsl(var(--card)); box-shadow:0 3px 10px rgba(28,45,65,.04); }
        .ua-panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px 12px; }
        .ua-overline { margin-bottom:2px; font-size:8px; }
        .ua-panel-heading h2 { margin:0; font-family:var(--app-font-display); font-size:20px; font-weight:600; line-height:1.2; }
        .ua-required { color:hsl(var(--muted-foreground)); font-size:9px; white-space:nowrap; }
        .ua-required span,.ua-label b { color:hsl(var(--accent)); }
        .ua-recruit-strip { display:grid; grid-template-columns:1fr 1fr .8fr; gap:12px; margin:0 18px; padding:10px 12px; background:hsl(var(--muted) / .72); border-left:2px solid hsl(var(--accent)); }
        .ua-recruit-strip div { display:grid; gap:2px; min-width:0; }
        .ua-recruit-strip span { color:hsl(var(--muted-foreground)); font-size:9px; }
        .ua-recruit-strip strong { font-size:11px; font-weight:700; }
        .ua-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; padding:15px 18px 12px; }
        .ua-field { display:grid; min-width:0; gap:5px; }
        .ua-label { display:block; color:hsl(var(--foreground)); font-size:11px; font-weight:700; }
        .ua-field select,.ua-district-control select { width:100%; height:38px; border:1px solid hsl(var(--input)); border-radius:3px; padding:0 10px; background:hsl(var(--card)); color:hsl(var(--foreground)); font:600 12px var(--app-font-sans); }
        .ua-field select:focus-visible,.ua-district-control select:focus-visible,.ua-choice:focus-within { outline:3px solid hsl(var(--ring) / .25); outline-offset:1px; border-color:hsl(var(--ring)); }
        .ua-context { display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 18px; padding:10px 12px; border:1px solid hsl(var(--border)); background:linear-gradient(90deg, hsl(var(--primary) / .055), hsl(var(--primary) / .015)); }
        .ua-context-copy { display:flex; align-items:center; gap:10px; min-width:0; }
        .ua-context-icon { flex:none; display:grid; width:35px; height:35px; place-items:center; border:1px solid hsl(var(--primary) / .3); color:hsl(var(--primary)); font-family:var(--app-font-display); font-weight:700; font-size:9px; letter-spacing:.05em; }
        .ua-context-copy p { margin:2px 0 0; color:hsl(var(--muted-foreground)); font-size:9px; }
        .ua-district-control { display:flex; align-items:center; gap:8px; flex:none; }
        .ua-district-control select { width:82px; height:35px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px; font-weight:700; }
        .ua-map-status { display:flex; align-items:center; gap:4px; color:hsl(var(--ok)); font-size:9px; font-weight:700; }
        .ua-map-status i { width:6px; height:6px; border-radius:50%; background:hsl(var(--ok)); }
        .ua-assignments { margin:15px 18px 0; padding:0; border:0; min-width:0; }
        .ua-assignments legend { padding:0; }
        .ua-help { margin:3px 0 9px; color:hsl(var(--muted-foreground)); font-size:10px; }
        .ua-choice-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
        .ua-choice { position:relative; display:flex; min-width:0; min-height:48px; align-items:center; gap:9px; padding:7px 9px; border:1px solid hsl(var(--border)); background:hsl(var(--card)); cursor:pointer; transition:background-color 130ms ease, border-color 130ms ease; }
        .ua-choice:hover { border-color:hsl(var(--primary) / .55); background:hsl(var(--primary) / .025); }
        .ua-choice.is-selected { border-color:hsl(var(--primary)); background:hsl(var(--primary) / .06); box-shadow:inset 3px 0 hsl(var(--primary)); }
        .ua-choice.is-requested { border-style:dashed; }
        .ua-choice.is-requested.is-selected { border-style:solid; }
        .ua-choice input { position:absolute; width:1px; height:1px; opacity:0; }
        .ua-radio { flex:none; width:15px; height:15px; border:1px solid hsl(var(--input)); border-radius:50%; background:hsl(var(--card)); }
        .ua-choice input:checked + .ua-radio { border:4px solid hsl(var(--primary)); }
        .ua-choice-main { display:grid; min-width:0; gap:2px; }
        .ua-choice-main strong { color:hsl(var(--foreground)); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; line-height:1.1; }
        .ua-choice-main small { color:hsl(var(--muted-foreground)); font-size:8.5px; line-height:1.25; }
        .ua-user-tag,.ua-selected-tag { margin-left:auto; padding:3px 4px; border:1px solid hsl(var(--accent) / .35); color:hsl(var(--accent)); font-size:7px; font-weight:800; letter-spacing:.06em; white-space:nowrap; }
        .ua-selected-tag { border-color:hsl(var(--primary) / .25); color:hsl(var(--primary)); }
        .ua-choice.is-selected .ua-user-tag { margin-left:0; }
        .ua-choice.is-selected .ua-selected-tag { margin-left:auto; }
        .ua-caution { display:flex; align-items:flex-start; gap:8px; margin-top:9px; padding:8px 10px; border-left:3px solid hsl(30 90% 40%); background:hsl(38 70% 95%); }
        .ua-caution-mark { display:grid; flex:none; width:15px; height:15px; place-items:center; border-radius:50%; background:hsl(30 90% 40%); color:white; font-size:10px; font-weight:800; }
        .ua-caution p { margin:0; color:hsl(214 32% 25%); font-size:9px; line-height:1.45; }
        .ua-summary { margin:14px 18px 16px; border:1px solid hsl(var(--border)); }
        .ua-summary-head { display:flex; align-items:center; gap:7px; padding:7px 10px; border-bottom:1px solid hsl(var(--border)); background:hsl(var(--muted) / .66); }
        .ua-summary-head strong { font-size:10px; }
        .ua-summary-dot { width:7px; height:7px; border-radius:50%; background:hsl(var(--ok)); }
        .ua-preview-label { margin-left:auto; color:hsl(var(--muted-foreground)); font-size:7px; font-weight:800; letter-spacing:.12em; }
        .ua-summary-values { display:grid; grid-template-columns:1.2fr .9fr .8fr 1fr; }
        .ua-summary-values div { display:grid; gap:3px; min-width:0; padding:8px 10px; border-right:1px solid hsl(var(--border)); }
        .ua-summary-values div:last-child { border-right:0; }
        .ua-summary-values span { color:hsl(var(--muted-foreground)); font-size:8px; }
        .ua-summary-values strong { overflow:hidden; color:hsl(var(--foreground)); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
        .ua-summary-values i { color:hsl(var(--accent)); font-style:normal; padding:0 2px; }
        .ua-summary-values .ua-code { color:hsl(var(--primary)); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
        .ua-footer { display:flex; align-items:center; gap:9px; padding-top:12px; }
        .ua-footer-rule { width:25px; height:2px; background:hsl(var(--accent)); }
        .ua-footer p { margin:0; color:hsl(var(--muted-foreground)); font-size:9px; }
        .ua-footer-meta { margin-left:auto; color:hsl(var(--muted-foreground)); font-size:7px; font-weight:800; letter-spacing:.11em; white-space:nowrap; }
        .ua-footer-meta i { color:hsl(var(--accent)); font-style:normal; padding:0 3px; }
        .ua-sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
        @media(max-width:650px) {
          .ua-shell { padding:14px 12px 18px; }
          .ua-title-row { padding-top:15px; }
          .ua-panel-heading { padding-inline:13px; }
          .ua-recruit-strip { grid-template-columns:1fr 1fr; margin-inline:13px; }
          .ua-recruit-strip div:last-child { grid-column:1 / -1; }
          .ua-grid { grid-template-columns:1fr; gap:9px; padding:13px; }
          .ua-context { align-items:flex-start; flex-direction:column; margin-inline:13px; }
          .ua-district-control { width:100%; }
          .ua-district-control select { flex:1; }
          .ua-assignments { margin-inline:13px; }
          .ua-choice-grid { grid-template-columns:1fr; }
          .ua-summary { margin-inline:13px; }
          .ua-summary-values { grid-template-columns:1fr 1fr; }
          .ua-summary-values div:nth-child(2) { border-right:0; }
          .ua-summary-values div:nth-child(-n+2) { border-bottom:1px solid hsl(var(--border)); }
        }
        @media(max-width:380px) {
          .ua-phase-mark { display:none; }
          .ua-user-tag { font-size:6px; }
          .ua-choice { gap:6px; padding-inline:7px; }
        }
        @media(prefers-reduced-motion:reduce) { .ua-choice { transition:none; } }
      `}</style>
    </main>
  );
}
