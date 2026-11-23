#!/usr/bin/env bash
# Disposable SYNTHETIC PostgreSQL cluster only. Never reads DATABASE_URL/PG*.
# Requires installed PostgreSQL tools. No network listener, production or app DB.
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"
out="$(mktemp -d "$root/generated-artifacts/launch-readiness/recovery-XXXXXX")"
socket="$(mktemp -d /tmp/fto-synthetic-socket-XXXXXX)"
chmod 700 "$socket"
clean() {
  env -i PATH="$PATH" pg_ctl -D "$out/data" -m fast stop >/dev/null 2>&1 || true
  rmdir "$socket" 2>/dev/null || true
}
trap clean EXIT
env -i PATH="$PATH" initdb -D "$out/data" --username=synthetic_owner \
  --auth-local=trust --auth-host=reject --encoding=UTF8 --no-locale > "$out/init.log"
env -i PATH="$PATH" pg_ctl -D "$out/data" -l "$out/server.log" \
  -o "-h '' -k '$socket' -p 55452" -w start > "$out/start.log"
sql() { env -i PATH="$PATH" psql -X -h "$socket" -p 55452 -U synthetic_owner -d postgres -v ON_ERROR_STOP=1 "$@"; }
sql -f artifacts/api-server/migrations/agency-training.sql > "$out/migration.log"
sql > "$out/fixture.log" <<'SQL'
CREATE ROLE synthetic_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA agency_training TO synthetic_runtime;
GRANT SELECT ON agency_training.assignments TO synthetic_runtime;
GRANT SELECT, INSERT ON agency_training.packet_assignments, agency_training.packets TO synthetic_runtime;
GRANT INSERT ON agency_training.packet_events TO synthetic_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_training TO synthetic_runtime;
INSERT INTO agency_training.assignments VALUES (
 '00000000-0000-4000-8000-000000000052','SYNTHETIC ONLY',2,
 repeat('a',64),repeat('b',64),'Fictional FTO',repeat('c',64),repeat('d',64),
 'Fictional PO',repeat('e',64),'2026-11-01','2026-11-30',true);
INSERT INTO agency_training.packet_assignments VALUES (
 'SYNTHETIC-RESTORE','00000000-0000-4000-8000-000000000052','2026-11-23',true);
INSERT INTO agency_training.packets (
 id,assignment_id,record_date,phase,operation_id,content_hash,report
) VALUES ('SYNTHETIC-RESTORE','00000000-0000-4000-8000-000000000052',
 '2026-11-23',2,'00000000-0000-4000-8000-000000000053',repeat('f',64),
 '{"synthetic":true,"narrative":"Fictional recovery rehearsal only"}');
INSERT INTO agency_training.packet_events (
 request_id,packet_id,actor_hash,actor_role,client_ip_hash,event_type,record_count
) VALUES ('00000000-0000-4000-8000-000000000054','SYNTHETIC-RESTORE',
 repeat('a',64),'FTO',repeat('b',64),'COMMIT',1);
SQL
# A failing event must roll back its preceding synthetic packet/assignment.
if sql > "$out/rollback-error.log" 2>&1 <<'SQL'
BEGIN;
INSERT INTO agency_training.packet_assignments VALUES (
 'SYNTHETIC-ROLLBACK','00000000-0000-4000-8000-000000000052','2026-11-24',true);
INSERT INTO agency_training.packets (
 id,assignment_id,record_date,phase,operation_id,content_hash,report
) VALUES ('SYNTHETIC-ROLLBACK','00000000-0000-4000-8000-000000000052',
 '2026-11-24',2,'00000000-0000-4000-8000-000000000055',repeat('f',64),'{"synthetic":true}');
INSERT INTO agency_training.packet_events (
 request_id,actor_hash,actor_role,client_ip_hash,event_type,record_count
) VALUES ('00000000-0000-4000-8000-000000000056',repeat('a',64),'FTO',repeat('b',64),'INVALID',1);
COMMIT;
SQL
then echo "Unexpected successful invalid-event transaction" >&2; exit 1; fi
[[ "$(sql -Atc "SELECT count(*) FROM agency_training.packets WHERE id='SYNTHETIC-ROLLBACK'")" == "0" ]]
[[ "$(sql -Atc "SELECT count(*) FROM agency_training.packet_assignments WHERE packet_id='SYNTHETIC-ROLLBACK'")" == "0" ]]
sql -Atc "SELECT has_table_privilege('synthetic_runtime','agency_training.packets','SELECT'),
has_table_privilege('synthetic_runtime','agency_training.packets','UPDATE'),
has_table_privilege('synthetic_runtime','agency_training.packet_events','DELETE'),
has_table_privilege('synthetic_runtime','agency_training.packet_events','TRUNCATE')" > "$out/grants.txt"
[[ "$(cat "$out/grants.txt")" == "t|f|f|f" ]]
fingerprint="SELECT (SELECT count(*) FROM agency_training.assignments),
(SELECT count(*) FROM agency_training.packet_assignments),
(SELECT count(*) FROM agency_training.packets),
(SELECT count(*) FROM agency_training.packet_events),
(SELECT md5(report::text) FROM agency_training.packets WHERE id='SYNTHETIC-RESTORE');"
sql -Atc "$fingerprint" > "$out/before.txt"
start="$(date +%s)"
env -i PATH="$PATH" pg_dump -h "$socket" -p 55452 -U synthetic_owner -d postgres \
  --format=custom --schema=agency_training > "$out/synthetic-only.dump"
env -i PATH="$PATH" createdb -h "$socket" -p 55452 -U synthetic_owner synthetic_restore
env -i PATH="$PATH" pg_restore -h "$socket" -p 55452 -U synthetic_owner \
  -d synthetic_restore --exit-on-error "$out/synthetic-only.dump" > "$out/restore.log" 2>&1
env -i PATH="$PATH" psql -X -h "$socket" -p 55452 -U synthetic_owner \
  -d synthetic_restore -v ON_ERROR_STOP=1 -Atc "$fingerprint" > "$out/after.txt"
diff -u "$out/before.txt" "$out/after.txt" > "$out/reconcile.txt"
env -i PATH="$PATH" psql -X -h "$socket" -p 55452 -U synthetic_owner \
  -d synthetic_restore -Atc "SELECT has_table_privilege('synthetic_runtime','agency_training.packets','UPDATE'),
has_table_privilege('synthetic_runtime','agency_training.packet_events','DELETE')" > "$out/restored-grants.txt"
[[ "$(cat "$out/restored-grants.txt")" == "f|f" ]]
{
  echo "PASS disposable PostgreSQL 16 migration"
  echo "PASS failed audit CHECK rolls back synthetic packet and binding"
  echo "PASS explicitly supplied synthetic grants deny packet UPDATE and event DELETE/TRUNCATE"
  echo "PASS backup restored to a second isolated DB; row counts and narrative hash match"
  echo "PASS restored synthetic grants remain restricted"
  echo "backup_restore_elapsed_seconds=$(( $(date +%s) - start ))"
  echo "NOT TESTED: agency TLS, installed runtime role/inheritance, encryption, backup retention, recovery keys, RPO/RTO, API races, SSO and off-host recovery"
} | tee "$out/results.txt"
printf '%s\n' "${out#"$root/"}" > "$root/generated-artifacts/launch-readiness/latest-recovery.txt"
