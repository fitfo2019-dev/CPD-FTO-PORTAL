# Synthetic four-phase packet stress test

## Result and readiness findings

The isolated four-phase run passed with a deterministic cohort of 100 fictional
recruits across all 15 configured program weeks. It created 6,800 daily reports,
1,500 weekly performance logs, 400 phase assignments/folders, 400 orientation
records, and 1,500 training runs. All 6,800 reports passed the existing report
validator. IDs, recruit attribution, weekly source links, phase/week labels,
and the long-text end markers were checked.

**Priority 1 — class workbook scale needs review before a full-cohort operational
export.** The supported workbook builder serialized successfully, but the
full-cohort workbook took 93.1 seconds to build and serialize and produced a
561,401,599-byte XLSX with 1,520 worksheets. The test verified the workbook’s
record counts and narrative endings in memory and confirmed XLSX serialization;
it did not open the file in Excel or LibreOffice. Do not treat this run as proof
that a full-class export is usable on operational devices.

**Priority 2 — the complete reports view is slow at this scale in the test
environment.** The mounted React reports page rendered 6,800 rows in 5.32
seconds and filtered to the 1,200 Phase IV rows in 2.15 seconds in JSDOM. This
is a reproducible signal, not a real-browser performance measurement.

The API lifecycle, encrypted local persistence, exact retry, paged list, detail
reads and explicit finalization passed. No production or policy change was made.
The existing 205-packet bounded client-queue test remains in place.

## Cohort and coverage

The fixture is stable and clearly synthetic (`FICTIONAL TEST ONLY`, `TEST-4P-*`,
`TEST-SCENARIO-*`). It contains no real names, badges, incidents, signatures or
official decisions. Each recruit has one assignment and phase folder for each
phase, every scheduled workday, one weekly log per phase-week, and unique daily,
run, weekly-log and orientation IDs.

| Program phase | Configured weeks | Fictional daily reports |
| --- | ---: | ---: |
| Phase I | 4 | 2,000 |
| Phase II | 4 | 2,000 |
| Phase III | 4 | 1,600 |
| Phase IV | 3 | 1,200 |
| **Total** | **15** | **6,800** |

Each recruit has 68 scheduled daily reports (20 + 20 + 16 + 12), 15 weekly
performance logs and 15 sample runs. Limbo days are represented according to
the existing schedule helpers. Long daily narratives include ending markers in
Phase I and Phase IV. Eight first/last-day Phase I–IV boundary views and one
Phase IV final-week print view for each of the 100 recruits were rendered. The
full cohort workbook contains 6,800 daily index rows, 400 phase-summary rows,
1,500 weekly-summary rows and 6,802 daily narrative rows.

The roster importer accepted all 400 phase assignments. The reports page was
mounted with the cohort, displayed all 6,800 rows, and its phase selector
filtered the list to exactly 1,200 Phase IV reports. Workbook assertions
verified daily IDs, phase totals, weekly row counts and the long-narrative end
marker. The packet print/page model and printable React view were exercised at
phase boundaries.

## Local lifecycle and API behavior

The full 6,800-report workspace was saved with the encrypted `OfflineStorage`
path and reopened from a fresh storage instance. The raw IndexedDB workspace
value was confirmed to be ciphertext, not readable narrative text. A separate
100-packet Phase IV selection exercised editable draft sync in batches. A
simulated lost response was retried after reopen using the same 100 operation
IDs and contents. One packet was explicitly finalized locally; the other 99
remained editable drafts.

The API test ran against a fresh in-memory PGlite database, an ephemeral
`127.0.0.1` loopback server, and a test-only FTO identity. It seeded only the
100 explicit Phase IV final-week assignments, checked readiness, synced
editable drafts, retried one exact request after discarding its response,
rejected a stale-version edit, paged all 100 list records, read all 100 details,
and explicitly finalized the selected Phase IV report for each recruit.
Retrieved report IDs, badges, names, phase and narrative endings were checked
against the requested recruit. Draft sync created no submission events;
finalization did not release a packet, create an acknowledgment, or add a
signature.

| API measure | Recorded result |
| --- | ---: |
| Readiness / draft sync | 20.98 ms / 881.99 ms |
| Upload batches | 71 + 29 packets |
| Serialized batch bodies | 2,079,744 + 891,275 bytes (2 MiB limit) |
| Upload batch elapsed time | 279.40 + 194.90 ms |
| Bounded collection pages | 69 + 31 records |
| Collection / 100 detail reads | 386.38 ms / 352.60 ms |
| 100 explicit finalizations | 860.66 ms |
| API test total | 6,251.87 ms |
| Expected API failures | 2: invalid mixed batch rolled back; stale version rejected |
| Exact request retries | 1 |
| Released / PO-acknowledged packets | 0 / 0 |
| API cleanup | Verified: this test’s assignment, packet, event, submission and coordinator rows removed |

## Recorded test-process measurements

These are representative measurements from isolated test-process runs in this
workspace; times vary by machine.

| Stage | Result |
| --- | ---: |
| Fictional cohort JSON size (reports, weekly logs, assignments) | 117,460,532 bytes |
| Fixture generation and integrity checks | 928.40 ms |
| Encrypted save of all daily reports | 5,295.79 ms |
| Encrypted workspace reopen | 1,497.25 ms |
| Reports view: initial 6,800 rows | 5,323.12 ms |
| Reports view: filter to Phase IV | 2,151.45 ms |
| Printable Phase IV views / rendered markup | 100 / 2,548,065 bytes in 381.31 ms |
| Full XLSX: worksheets / serialized size | 1,520 / 561,401,599 bytes |
| Workbook build, XLSX serialization and boundary exports | 86,436.05 ms |
| XLSX serialization portion | 46,339.14 ms |
| Local interrupted request / exact retry | 1 / 100 packet operations |
| Local explicitly finalized / remaining drafts | 1 / 99 |

## Reproduction

Run from the workspace root. The commands use test processes and do not start a
preview or connect to an agency service:

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/field-training run typecheck
pnpm run typecheck:field-training:tests
TZ=America/New_York TSX_TSCONFIG_PATH=$PWD/artifacts/field-training/tsconfig.test.json \
  pnpm --filter @workspace/scripts exec tsx --test \
  ../artifacts/field-training/src/lib/four-phase-packet-stress.test.tsx
TZ=America/New_York TSX_TSCONFIG_PATH=$PWD/artifacts/field-training/tsconfig.test.json \
  pnpm --filter @workspace/scripts exec tsx --test \
  ../artifacts/field-training/src/lib/test-packet.test.ts
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/scripts exec tsx --test \
  ../artifacts/api-server/test/packet-stress.test.ts
```

The cohort test constructs the fixture twice and compares all report and weekly
log IDs plus the long-text ending marker. Storage uses unique namespaces in
`fake-indexeddb`; its records exist only for the test process and are discarded
when that process exits. The API test deletes its own rows, checks that they are
gone, closes PGlite and stops the loopback server.

## Boundaries and limitations

- The environment was Node.js v24.22.3, `fake-indexeddb`, Node Web Crypto, JSDOM,
  Vite server-side module loading, in-memory PGlite and loopback HTTP. No open
  preview, production database, agency service, real account or external
  endpoint was used.
- The API assignment rows were explicitly seeded in disposable test storage.
  This is not a test of agency roster provisioning or operational permissions.
- The page view was mounted in JSDOM, not a real browser. Browser layout,
  scrolling, input behavior at scale, device performance and signed-in UI were
  not measured.
- Print verification rendered page-model and React markup for eight phase
  boundaries. It did not generate/inspect PDF bytes, run `window.print`, certify
  pagination on paper, or test a physical printer.
- Workbook serialization succeeded and its in-memory records were checked, but
  the 561 MB output was not opened in a desktop spreadsheet application.
- The run does not establish live database throughput, identity configuration,
  network interruption behavior, device quota, agency acceptance or operational
  readiness.
