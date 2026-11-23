# Source Trace and Preview Boundaries

- `Current.tsx` renders the duty stage extracted from
  `artifacts/field-training/src/pages/report-editor.tsx` (duty-form panel).
- `_source.tsx` retains the real checklist labels and keys from
  `artifacts/field-training/src/lib/model.ts` (`DAILY_DUTY_CHECKLIST`),
  field/Panel markup, and duty-stage controls.
- `_group.css` retains the shipping portal's light tokens, Arial body,
  Oswald heading and native input treatment from `src/index.css`.
- `new-run-dialog.tsx` and `run-sheet-workflow` are behavioral references.
  No API clients, auth providers, vaults, real records, storage or sync are imported.
- Workspace state and deficiency side effects are replaced with controlled
  memory-only fixtures. This is not an operational ratings engine.
- The Law Library schema's palette and typography were not approved. This
  extraction uses the existing portal's self-themed source, not that package.
- `FocusedWorkflow.tsx` is a new sibling composition, not an edit to Current or
  any portal screen. All saves and dispatch lookups are visibly synthetic.
