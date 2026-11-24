# Synthetic 205-packet stress run

## Result

The packet queue now drains from one explicit sync orchestration in sequential
requests. Each request is kept under both existing limits: 100 packet records
and 2 MiB of serialized UTF-8 JSON. The client acknowledges each successful
batch before continuing. If a response is lost, that batch retains its exact
encrypted snapshot and operation IDs; prior batches remain acknowledged and
later batches remain unattempted. A packet too large to fit by itself fails
before it is marked attempted. Draft synchronization never finalizes a packet.

No visible interface changed.

## Reproduction

Run from the workspace root:

```sh
pnpm run typecheck:libs
pnpm run typecheck:field-training:tests
pnpm --filter @workspace/field-training exec tsx --test --test-name-pattern='LR-14|oversized packet' src/lib/launch-readiness.test.ts
pnpm --filter @workspace/field-training exec tsx --test src/lib/test-packet.test.ts
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/test/packet-stress.test.ts
```

The fixture `createFtoPacketStressWorkspace()` deterministically creates 205
unique fictional POs, phase folders, local assignments, packet IDs and varied
narratives. The client test saves the records into a passphrase-encrypted
IndexedDB emulator, locks and reopens it, commits one simulated batch and
simulates a lost response after the next batch commits. It verifies exact retry
identities and contents, the acknowledged/unconfirmed/unprocessed boundaries,
all-request limits, and an empty queue after retry. A separate oversized
single-record test confirms that the request is not attempted and cancellation
does not start another request.

The API stress test creates a fresh in-memory PGlite database, applies the
packet schema and review guards, seeds only fictional FTO/PO assignments,
starts an ephemeral loopback HTTP server, and injects a test-only FTO identity.
It verifies mixed-batch rollback, size-aware upload, idempotent replay after a
discarded response, stale-version conflict, 205 individual detail reads,
bounded collection reads, and explicit finalization of each of the 205 packets.
It then removes only its own rows, verifies the test class has no remaining
assignments, packets or submissions, closes the database, and stops the server.
These tests issue no requests to the preview, agency adapter, external service,
or operational database.

## Recorded local run

Measurements below are illustrative results from one Node test run in this
workspace; timings vary by machine. “Local storage” and “browser” responsiveness
are measured only through `fake-indexeddb`, not a real browser.

| Stage | Result |
| --- | --- |
| Fictional packet count | 205 |
| Encrypted local save | 232 ms |
| Reopen/unlock | 102 ms |
| Client retry and queue drain | 1,496 ms |
| Client request attempts | 4, including one exact retry |
| Client serialized request sizes | 2,056,509; 2,091,151; 2,091,151; 1,795,581 bytes |
| API upload batch sizes | 62, 57, 53, 33 packets |
| API serialized request sizes | 2,075,484; 2,025,365; 2,082,921; 1,327,629 bytes |
| API readiness / draft sync | 43 ms / 1,901 ms |
| API batch times, including database work | 241; 323; 179; 239 ms |
| API collection / individual detail reads | 118 ms for 100; 876 ms for all 205 |
| Explicit finalization of 205 packets | 1,828 ms |
| API test total | 7,985 ms |
| Exercised failures / retry | Invalid mixed batch rolled back; stale version rejected; one exact retry |
| Cleanup | Verified |
| Release / PO acknowledgment | Not performed |

## Coverage boundaries

- The portal’s class posting, sign-up, roster import and assignment editor store
  local device data; they cannot provision the trusted server roster. The test
  therefore seeds fictional assignments only in its disposable PGlite database.
  This is test authority, not official assignment or agency provisioning.
- The supported roster parser accepts all 205 synthetic CSV rows, and the
  deterministic workspace contains the class, phase, assignments and complete
  packet-shaped entries. The React setup/import/report screens were not driven
  in a real browser, so field-level UI entry, keystrokes, rendering and save
  behavior remain unverified at that boundary.
- The shared collection endpoint currently returns at most 100 records and has
  no paging parameter. The test checks that cap and individually reads all 205
  records. Browsing the complete history in one collection view remains outside
  this test’s verified behavior.
- The client storage measurements use an IndexedDB emulator. Real-browser
  storage pressure, rendering responsiveness and network interruption should
  be measured in an approved isolated browser environment before operational
  use.
- This test does not certify production PostgreSQL, agency identity, physical
  devices, agency networks, printing or office-suite acceptance.
