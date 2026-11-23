import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import "./_group.css";

type TaskKey =
  | "building_orientation" | "locker_rooms" | "restrooms" | "break_room" | "vending" | "vehicle_status_board" | "cruiser_keys" | "relief_car" | "computer_access" | "daily_bulletin" | "bwc_tower" | "precinct_information" | "division_email" | "paperwork_box" | "outgoing_mail" | "subpoena_book" | "traffic_citation_book" | "parking_citation_book" | "radar_laser" | "taser_location" | "taser_log" | "taser_spark_test" | "taser_belt" | "shotgun_locker" | "clearing_barrel" | "paperwork_supplies" | "briefcase_clipboard" | "copier_printer"
  | "riot_helmet" | "riot_padding" | "rain_gear" | "traffic_vest" | "tychem" | "tyvek" | "gas_mask" | "gas_mask_card" | "mask_filter" | "rubber_gloves" | "rubber_boots" | "chem_tape" | "directives" | "complaint_manual" | "aid_manual"
  | "cruiser_inspection" | "prisoner_compartment" | "cvs" | "shotgun_rack" | "pa_system" | "trunk_equipment" | "emergency_lights" | "personal_equipment" | "seat_belt"
  | "car_radio" | "computer" | "walkie" | "radios" | "emergency_banners" | "police_fire" | "car_to_car" | "communications_failure" | "division_computer" | "internet" | "ohleg" | "leads" | "courtview" | "common_pleas" | "s_drive" | "powerdms" | "daily_email"
  | "boundaries" | "cruiser_districts" | "directions" | "major_roads" | "one_way_streets" | "cfd_stations" | "hospitals" | "landmarks" | "schools" | "adjacent_precincts" | "problem_areas" | "other_areas" | "review_directives_sop";

type Row = { id: TaskKey; keys: readonly TaskKey[]; label: string };
type Section = { title: string; description: string; items: readonly (readonly [TaskKey, string])[]; rows: Row[] };

const RAW_SECTIONS = [
  { title: "Substation Orientation", description: "Complete each item during the first day only.", items: [
    ["building_orientation", "Building orientation"], ["locker_rooms", "Locker rooms"], ["restrooms", "Restroom facilities"], ["break_room", "Break room"],
    ["vending", "Vending machines, microwave, refrigerator"], ["vehicle_status_board", "Vehicle status board"], ["cruiser_keys", "Location of cruiser keys"], ["relief_car", "Explained relief car"], ["computer_access", "Computer access"],
    ["daily_bulletin", "Daily Bulletin"], ["bwc_tower", "BWC Tower"], ["precinct_information", "Precinct specific information"], ["division_email", "Division email"], ["paperwork_box", "End of shift paperwork in box"], ["outgoing_mail", "Outgoing mail box"],
    ["subpoena_book", "Subpoena sign-out book"], ["traffic_citation_book", "Acquisition of traffic citation book"], ["parking_citation_book", "Acquisition of parking citation book"], ["radar_laser", "Radar and Laser units (location and sign out)"],
    ["taser_location", "Location of Taser"], ["taser_log", "Taser sign-out log"], ["taser_spark_test", "Proper Taser testing (spark test)"], ["taser_belt", "Location of Taser properly placed on gun belt"], ["shotgun_locker", "Location of shotgun locker"],
    ["clearing_barrel", "Location of the clearing barrel"], ["paperwork_supplies", "Location of paperwork and supplies"], ["briefcase_clipboard", "Briefcase/clipboard setup"], ["copier_printer", "Location of copier and printer"],
  ] },
  { title: "Inspectional Items", description: "Check the inspectional items listed on the form.", items: [
    ["riot_helmet", "Riot helmet with face shield"], ["riot_padding", "Riot protective padding"], ["rain_gear", "Raincoat and pants"], ["traffic_vest", "Traffic control vest"], ["tychem", "TYCHEM F protective suit (green)"], ["tyvek", "TYVEK protective suit (white)"],
    ["gas_mask", "Gas mask"], ["gas_mask_card", "Gas mask inspection card"], ["mask_filter", "One filter for mask"], ["rubber_gloves", "One pair protective rubber gloves"], ["rubber_boots", "One pair protective rubber boots"],
    ["chem_tape", "One roll Chem tape"], ["directives", "Division Directives"], ["complaint_manual", "Criminal Complaint Manual"], ["aid_manual", "Aid to Enforcement Manual"],
  ] },
  { title: "Cruiser Orientation", description: "Complete each cruiser orientation item.", items: [
    ["cruiser_inspection", "Proper inspection of interior and exterior of cruiser"], ["prisoner_compartment", "Proper inspection of prisoner compartment for contraband/weapons"], ["cvs", "CVS system"], ["shotgun_rack", "Shotgun rack/release"], ["pa_system", "PA system"], ["trunk_equipment", "Equipment stored in trunk"],
    ["emergency_lights", "Location/function of emergency lights/siren switches"], ["personal_equipment", "Placement of personal equipment"], ["seat_belt", "Seat belt usage"],
  ] },
  { title: "Communications Orientation", description: "Complete each communications orientation item.", items: [
    ["car_radio", "Use of car radio"], ["computer", "Use of computer"], ["walkie", "Use of walkie"], ["radios", "Function and use of radios"], ["emergency_banners", "Location of emergency banners (cruiser radio, computer, walkie)"],
    ["police_fire", "Police-Fire talkgroup"], ["car_to_car", "Car-to-car communication"], ["communications_failure", "Emergency operations during communications failure"], ["division_computer", "Use of Division computer system"],
    ["internet", "Internet usage"], ["ohleg", "OHLEG"], ["leads", "LEADS"], ["courtview", "Courtview"], ["common_pleas", "Common Pleas"], ["s_drive", "Use of S: drive"], ["powerdms", "PowerDMS"], ["daily_email", "Check email daily"],
  ] },
  { title: "Precinct Orientation", description: "Complete each precinct orientation item.", items: [
    ["boundaries", "Boundaries"], ["cruiser_districts", "Cruiser districts"], ["directions", "Directions"], ["major_roads", "Major roads and intersections"], ["one_way_streets", "One-way streets"], ["cfd_stations", "CFD stations"], ["hospitals", "Hospitals"],
    ["landmarks", "Landmarks"], ["schools", "Schools"], ["adjacent_precincts", "Adjacent precincts"], ["problem_areas", "Known problem areas"], ["other_areas", "Other areas"],
  ] },
  { title: "Review of Division Directives, SOP, etc. (List)", description: "Complete the review and list the items reviewed.", items: [
    ["review_directives_sop", "Review of Division Directives, SOP, etc. (List)"],
  ] },
] as const;

const COMBINED_ROWS: readonly (readonly TaskKey[])[] = [
  ["building_orientation", "locker_rooms", "restrooms", "break_room", "vending"],
  ["vehicle_status_board", "cruiser_keys", "relief_car"],
  ["computer_access", "daily_bulletin", "division_email"],
  ["paperwork_box", "outgoing_mail", "subpoena_book"],
  ["traffic_citation_book", "parking_citation_book"],
  ["paperwork_supplies", "briefcase_clipboard", "copier_printer"],
  ["riot_helmet", "riot_padding"], ["rain_gear", "traffic_vest"], ["tychem", "tyvek"],
  ["rubber_gloves", "rubber_boots", "chem_tape"], ["directives", "complaint_manual", "aid_manual"],
  ["cvs", "pa_system"], ["trunk_equipment", "personal_equipment"],
  ["car_radio", "walkie", "radios", "car_to_car"], ["computer", "division_computer"],
  ["ohleg", "leads", "courtview", "common_pleas"], ["internet", "s_drive", "powerdms", "daily_email"],
  ["boundaries", "cruiser_districts", "adjacent_precincts"],
  ["directions", "major_roads", "one_way_streets"],
  ["cfd_stations", "hospitals", "landmarks", "schools"],
];

const SECTIONS: Section[] = RAW_SECTIONS.map((section) => {
  const remaining = new Set<TaskKey>(section.items.map(([key]) => key));
  const labels = new Map<TaskKey, string>(section.items.map(([key, label]) => [key, label]));
  const rows: Row[] = [];
  for (const [key] of section.items) {
    if (!remaining.has(key)) continue;
    const keys = COMBINED_ROWS.find((group) => group.includes(key)) ?? [key];
    rows.push({ id: key, keys, label: keys.map((item) => labels.get(item)).join("; ") });
    keys.forEach((item) => remaining.delete(item));
  }
  return { ...section, rows };
});
const TASK_KEYS = RAW_SECTIONS.flatMap((section) => section.items.map(([key]) => key)) as TaskKey[];
const ROW_COUNT = SECTIONS.reduce((sum, section) => sum + section.rows.length, 0);
const COLUMNS = [[0], [1, 2], [3, 4]] as const;

type FormState = {
  poName: string; poBadge: string; ftoName: string; ftoBadge: string; substation: string;
  className: string; phase: string; date: string; time: string; pageReference: string;
  directives: string; narrative: string;
};
const INITIAL_FORM: FormState = {
  poName: "Synthetic Demo Recruit", poBadge: "DEMO-014", ftoName: "Synthetic Demo FTO", ftoBadge: "DEMO-027",
  substation: "Substation 4 (Demo)", className: "DEMO-2026-A", phase: "1", date: "06/02/2026", time: "08:00",
  pageReference: "Phase I · Day 1 · Page 2 (demo)", directives: "Synthetic demo entry", narrative: "Fictional walkthrough notes only.",
};

export function EditableOrientation() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [checklist, setChecklist] = useState<Record<TaskKey, boolean>>(() =>
    Object.fromEntries(TASK_KEYS.map((key) => [key, true])) as Record<TaskKey, boolean>);
  const [reviewed, setReviewed] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const checkedTasks = TASK_KEYS.filter((key) => checklist[key]).length;
  const coveredRows = SECTIONS.reduce((sum, section) => sum + section.rows.filter((row) => row.keys.every((key) => checklist[key])).length, 0);
  const allChecked = checkedTasks === TASK_KEYS.length;

  const editField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.target.name as keyof FormState;
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setReviewed(false);
  };
  const toggleRow = (keys: readonly TaskKey[], checked: boolean) => {
    setChecklist((current) => {
      const next = { ...current };
      keys.forEach((key) => { next[key] = checked; });
      return next;
    });
    setReviewed(false);
  };
  const toggleAll = () => {
    const value = !allChecked;
    setChecklist(Object.fromEntries(TASK_KEYS.map((key) => [key, value])) as Record<TaskKey, boolean>);
    setReviewed(false);
  };

  return (
    <main className="orientation-preview">
      <header className="orientation-topbar">
        <div className="orientation-topbar-inner">
          <div className="orientation-brand">
            <img className="orientation-brand-logo" src="/__mockup/images/fto-columbus-logo.svg" alt="Columbus FTO" />
            <img className="orientation-brand-seal" src="/__mockup/images/fto-police-patch.png" alt="Columbus Division of Police patch" />
            <div className="orientation-brand-copy"><strong>Field Training Officer Portal</strong><span>Columbus Division of Police · Field Training Program</span></div>
          </div>
          <div className="orientation-top-actions">
            <span className="orientation-demo-chip">Fictional demo · memory only</span>
            <button className="orientation-button orientation-button-primary" type="button" onClick={() => window.print()}>Print / PDF</button>
          </div>
        </div>
      </header>

      <div className="orientation-content">
        <div className="orientation-intro">
          <div><p className="orientation-kicker">Interactive form preview · one-sheet walkthrough</p><h1>Substation Orientation</h1><p>Review the original checklist together. Edit the fictional demo fields, mark only tasks covered, then confirm the review at the bottom of the sheet.</p></div>
        </div>
        <aside className="orientation-safety" aria-label="Preview data boundary">
          <strong>Memory-only preview</strong>
          <span>Nothing is connected to the server: no Clerk, API, database, or IndexedDB. Edits stay in this browser tab’s memory and reload resets all values.</span>
        </aside>
        <div className="orientation-controls">
          <p>Complete this before the first shift of each phase. Every checklist item starts checked for quick review; clear anything not completed during the walkthrough.</p>
          <div className="orientation-controls-actions">
            <button className="orientation-button" type="button" onClick={toggleAll}>{allChecked ? "Deselect all" : "Select all"}</button>
            <button className="orientation-button orientation-button-primary" type="button" onClick={() => window.print()}>Print / PDF</button>
          </div>
        </div>

        <article className="orientation-paper" aria-label="Editable Substation Orientation form preview">
          <header className="orientation-sheet-head">
            <div className="orientation-sheet-brand">
              <img src="/__mockup/images/fto-silver-badge.png" alt="Columbus Police badge" />
              <div className="orientation-sheet-heading">
                <p>Columbus Division of Police · Field Training Program</p>
                <h2>Substation Orientation</h2>
                <div className="orientation-sheet-id">U-10.181 (05/23)</div>
              </div>
            </div>
            <div className="orientation-sheet-instruction">Complete on the first scheduled day of each phase.</div>
          </header>
          <p className="orientation-sheet-subtitle">FTO / PO walkthrough checklist · records items covered, not performance ratings.</p>

          <div className="orientation-meta-grid">
            <Field label="Probationary Officer name" name="poName" value={form.poName} onChange={editField} />
            <Field label="PO badge" name="poBadge" value={form.poBadge} onChange={editField} />
            <Field label="FTO name" name="ftoName" value={form.ftoName} onChange={editField} />
            <Field label="FTO badge" name="ftoBadge" value={form.ftoBadge} onChange={editField} />
            <Field label="Substation" name="substation" value={form.substation} onChange={editField} />
            <Field label="Class" name="className" value={form.className} onChange={editField} />
            <Field label="Phase" name="phase" value={form.phase} onChange={editField} />
            <Field label="Date" name="date" value={form.date} onChange={editField} />
            <Field label="Time" name="time" value={form.time} onChange={editField} />
            <Field label="Training-folder page reference" name="pageReference" value={form.pageReference} onChange={editField} wide />
          </div>

          <div className="orientation-checklist-head">
            <h3>Walkthrough checklist</h3>
            <div className="orientation-counts" aria-live="polite">
              <span><strong>{checkedTasks}</strong> of {TASK_KEYS.length} original tasks covered</span>
              <span><strong>{coveredRows}</strong> of {ROW_COUNT} combined rows covered</span>
              <span><strong>{reviewed ? "Reviewed" : "Review required"}</strong></span>
            </div>
          </div>
          <p className="orientation-coverage-note">☒ covered · ☐ not yet covered. A combined row is checked only when ALL listed tasks were covered. New forms start checked; review every row with the PO before treating it as covered.</p>

          <div className="orientation-columns">
            {COLUMNS.map((column, columnIndex) => (
              <div className="orientation-column" key={columnIndex}>
                {column.map((sectionIndex) => {
                  const section = SECTIONS[sectionIndex];
                  return (
                    <section className="orientation-section" key={section.title}>
                      <h3>{section.title}</h3>
                      <p className="orientation-section-description">{section.description} {section.items.length} tasks · {section.rows.length} rows.</p>
                      <ul className="orientation-task-list">
                        {section.rows.map((row) => (
                          <TaskRow key={row.id} row={row} checklist={checklist} onToggle={toggleRow} />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="orientation-bottom">
            <section className="orientation-section">
              <h3>{SECTIONS[5].title}</h3>
              <p className="orientation-section-description">{SECTIONS[5].description} 1 task · 1 row.</p>
              <ul className="orientation-task-list">
                {SECTIONS[5].rows.map((row) => <TaskRow key={row.id} row={row} checklist={checklist} onToggle={toggleRow} />)}
              </ul>
            </section>
            <div>
              <div className="orientation-text-box orientation-directives">
                <label htmlFor="orientation-directives">Division Directives / SOP reviewed (list)</label>
                <textarea id="orientation-directives" name="directives" value={form.directives} onChange={editField} />
              </div>
              <div className="orientation-text-box">
                <label htmlFor="orientation-narrative">Additional narrative / continuation</label>
                <textarea id="orientation-narrative" name="narrative" value={form.narrative} onChange={editField} />
              </div>
            </div>
          </div>

          <div className="orientation-review-bar" ref={reviewRef}>
            <p className="orientation-review-status" aria-live="polite">{reviewed ? "Review confirmed. Any further edit clears this confirmation." : "After walking through every row with the PO, confirm the review below the list."}</p>
            <button
              className="orientation-button orientation-button-primary"
              type="button"
              disabled={reviewed}
              aria-label={reviewed ? "Checklist review confirmed" : "Confirm checklist review"}
              onClick={() => { setReviewed(true); reviewRef.current?.focus(); }}
            >
              {reviewed ? "Review confirmed" : "Confirm checklist review"}
            </button>
          </div>
          <footer className="orientation-sheet-footer">
            <span>FTO / PO walkthrough checklist · records items covered, not performance ratings.</span>
            <span>Local copy · not server-confirmed or electronically signed.</span>
          </footer>
        </article>
        <div className="orientation-statusline"><span>Source form: <strong>U-10.181 (05/23) · Substation Orientation</strong></span><span>{TASK_KEYS.length} original tasks · {ROW_COUNT} printed checklist rows</span></div>
      </div>
    </main>
  );
}

function Field({ label, name, value, onChange, wide = false }: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  wide?: boolean;
}) {
  return (
    <div className={`orientation-field${wide ? " orientation-meta-wide" : ""}`}>
      <label htmlFor={`orientation-${name}`}>{label}</label>
      <input id={`orientation-${name}`} name={name} value={value} onChange={onChange} />
    </div>
  );
}

function TaskRow({ row, checklist, onToggle }: {
  row: Row;
  checklist: Record<TaskKey, boolean>;
  onToggle: (keys: readonly TaskKey[], checked: boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const count = row.keys.filter((key) => checklist[key]).length;
  const checked = count === row.keys.length;
  const mixed = count > 0 && count < row.keys.length;
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = mixed;
  }, [mixed]);
  const labels = row.label.split("; ");
  return (
    <li>
      <label className={`orientation-task${row.keys.length > 1 ? " is-group" : ""}${mixed ? " is-mixed" : ""}`}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          aria-checked={mixed ? "mixed" : checked}
          aria-label={row.keys.length > 1 ? `${labels.join(", ")}; ${count} of ${row.keys.length} covered` : row.label}
          onChange={(event) => onToggle(row.keys, event.target.checked)}
        />
        {row.keys.length > 1 ? (
          <span className="orientation-task-labels">{labels.map((label) => <span key={label}>{label}</span>)}</span>
        ) : <span>{row.label}</span>}
        {row.keys.length > 1 && <span className="orientation-task-count">{count}/{row.keys.length}</span>}
      </label>
    </li>
  );
}
