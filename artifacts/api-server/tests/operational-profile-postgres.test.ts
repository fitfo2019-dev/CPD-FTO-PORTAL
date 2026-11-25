import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import pg from "pg";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { createOperationalProfileStore } from "../src/lib/operational-profile-store.js";
import { hashUserIdentifier } from "../src/utils/cryptoUtils.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";

const legacy: AgencyIdentity = { id: "FICTIONAL-LEGACY-FTO", badge: "TEST-100", role: "FTO" };
const fto: AgencyIdentity = { id: "FICTIONAL-NEW-FTO", badge: "TEST-101", role: "FTO" };
const po: AgencyIdentity = { id: "FICTIONAL-NEW-PO", badge: "TEST-102", role: "PO" };
const permissionDenied = { code: "42501" };
const versionConflict = { status: 409, code: "PROFILE_VERSION_CONFLICT" };

// A private Unix socket and freshly initialized cluster: never read connection
// settings or connect to a project/agency database. Missing binaries fail, not skip.
test("optional-side upgrade preserves agency permissions on real PostgreSQL", async t => {
  const dir = mkdtempSync(join(tmpdir(), "profile-postgres-"));
  const dataDir = join(dir, "data");
  const port = 55439;
  let started = false;
  let owner: pg.Pool | undefined;
  let runtime: pg.Pool | undefined;
  try {
    execFileSync("initdb", ["-D", dataDir, "-U", "profile_owner", "-A", "trust", "--no-locale"], { stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", dataDir, "-l", join(dir, "postgres.log"), "-o",
      `-k ${dir} -h '' -p ${port} -F`, "-w", "start"], { stdio: "pipe" });
    started = true;
    const connection = { host: dir, port, database: "postgres", max: 4 };
    const db = owner = new pg.Pool({ ...connection, user: "profile_owner" });
    const migrate = (name: string) => db.query(
      readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"),
    );
    await migrate("agency-training");
    await migrate("agency-training-packet-review");
    await migrate("agency-training-packet-guards");
    await migrate("operational-profiles");
    await db.query(`CREATE ROLE profile_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
      GRANT USAGE ON SCHEMA agency_training TO profile_runtime;
      GRANT SELECT ON agency_training.assignments, agency_training.coordinator_directory TO profile_runtime;
      GRANT SELECT, INSERT ON agency_training.operational_profiles TO profile_runtime;
      GRANT UPDATE (assignment_token,cruiser_number,cad_unit,company,side,version,updated_at)
        ON agency_training.operational_profiles TO profile_runtime;`);
    const limited = runtime = new pg.Pool({ ...connection, user: "profile_runtime" });
    const store = createOperationalProfileStore(limited);
    await db.query(`INSERT INTO agency_training.operational_profiles
      (subject_hash,assignment_token,cruiser_number,cad_unit,company,side,version)
      VALUES ($1,'9150E-1','9150','9150E','E','1',7)`, [hashUserIdentifier(legacy.id)]);
    const rosterId = randomUUID();
    await db.query(`INSERT INTO agency_training.assignments
      (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,starts_on,ends_on)
      VALUES ($1,'FICTIONAL CLASS',1,$2,$3,'Fictional FTO',$4,$5,'Fictional PO','2026-01-01','2026-12-31')`,
    [rosterId, hashUserIdentifier(legacy.id), hashUserIdentifier(legacy.badge),
      hashUserIdentifier(po.id), hashUserIdentifier(po.badge)]);
    await db.query(`INSERT INTO agency_training.coordinator_directory VALUES ('FICTIONAL-COORDINATOR','Fictional Coordinator',true)`);
    const row = async (identity: AgencyIdentity) => (await db.query(
      "SELECT * FROM agency_training.operational_profiles WHERE subject_hash=$1", [hashUserIdentifier(identity.id)],
    )).rows[0];
    const rosterBefore = (await db.query("SELECT * FROM agency_training.assignments")).rows;
    const directoryBefore = (await db.query("SELECT * FROM agency_training.coordinator_directory")).rows;
    const oldRow = await row(legacy);
    await migrate("operational-profile-optional-sides");

    await t.test("migration retains legacy evidence and invalidates former profile versions", async () => {
      const upgraded = await row(legacy);
      assert.equal(upgraded.cruiser_number, oldRow.cruiser_number);
      assert.equal(upgraded.assignment_token, oldRow.assignment_token);
      assert.equal(upgraded.side, oldRow.side);
      assert.equal(upgraded.district_token, "9150");
      assert.equal(upgraded.cad_unit, "9150E-1");
      assert.equal(upgraded.version, 8);
      assert.ok(upgraded.updated_at >= oldRow.updated_at);
      assert.equal((await store.read(legacy)).version, 8);
      const privileges = (await limited.query(`SELECT current_user,
        (SELECT rolsuper OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname=current_user) AS elevated,
        pg_has_role(current_user,'profile_owner','MEMBER') AS owner_member,
        (SELECT tableowner=current_user FROM pg_tables
          WHERE schemaname='agency_training' AND tablename='operational_profiles') AS owns_table`)).rows[0];
      assert.deepEqual(privileges, { current_user: "profile_runtime", elevated: false, owner_member: false, owns_table: false });
    });

    await t.test("old column UPDATE grants fail explicitly without partially changing a legacy profile", async () => {
      const before = await row(legacy);
      await assert.rejects(store.save(legacy, { assignmentToken: "1234A", expectedVersion: 8 }), permissionDenied);
      assert.deepEqual(await row(legacy), before);
    });

    await t.test("column INSERT grants missing district_token reject creation without inserting a row", async () => {
      // Table-wide INSERT covers future columns; narrow it before proving the
      // missing INSERT-column grant, separately from the missing UPDATE grant.
      await db.query(`REVOKE INSERT ON agency_training.operational_profiles FROM profile_runtime;
        GRANT INSERT (subject_hash,assignment_token,cad_unit,company,side)
          ON agency_training.operational_profiles TO profile_runtime;`);
      for (const assignmentToken of ["9150E", "9150E-2"]) {
        await assert.rejects(store.save(fto, { assignmentToken, expectedVersion: 0 }), permissionDenied);
        assert.equal(await row(fto), undefined);
      }
    });

    // Execute the exact documented grants so documentation and the permission
    // fixture cannot quietly diverge. Replace only the example role identifier.
    const documentation = readFileSync(new URL("../../../docs/OPERATIONAL_PROFILES.md", import.meta.url), "utf8");
    const grants = documentation.match(/<!-- profile-runtime-grants -->\s*```sql\n([\s\S]*?)```/);
    assert.ok(grants, "documented profile runtime grants must exist");
    await db.query(grants[1].replaceAll("agency_runtime", "profile_runtime"));

    await t.test("documented column grants allow sided and unsided creation and exact derivations", async () => {
      assert.equal((await store.read(fto)).version, 0);
      for (const [identity, assignmentToken] of [[fto, "9150E-2"], [po, "1234A"]] as const) {
        const saved = await store.save(identity, { assignmentToken, expectedVersion: 0 });
        assert.equal(saved.version, 1);
        assert.deepEqual(saved.identity, parseOperationalIdentity(assignmentToken));
        assert.deepEqual((await store.read(identity)).identity, saved.identity);
        const raw = await row(identity);
        assert.equal(raw.cad_unit, assignmentToken);
        assert.equal(raw.district_token, saved.identity?.districtToken);
        assert.equal(raw.company, saved.identity?.company);
        assert.equal(raw.side, saved.identity?.side ?? null);
        assert.equal(raw.cruiser_number, null);
      }
    });

    await t.test("competing creation and updates use compare-and-swap without partial derived values", async () => {
      const raced: AgencyIdentity = { ...fto, id: "FICTIONAL-RACING-FTO" };
      const compete = async (identity: AgencyIdentity, expectedVersion: number) => {
        const tokens = ["9151E", "9152A-1"];
        const results = await Promise.allSettled(tokens.map(assignmentToken =>
          store.save(identity, { assignmentToken, expectedVersion })));
        assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
        const rejection = results.find(result => result.status === "rejected");
        assert.ok(rejection?.status === "rejected");
        assert.equal(rejection.reason.status, 409);
        assert.equal(rejection.reason.code, versionConflict.code);
        const winner = results.findIndex(result => result.status === "fulfilled");
        const raw = await row(identity);
        const derived = parseOperationalIdentity(tokens[winner]);
        assert.equal(raw.version, expectedVersion + 1);
        assert.equal(raw.assignment_token, derived.assignmentToken);
        assert.equal(raw.district_token, derived.districtToken);
        assert.equal(raw.cad_unit, derived.cadUnit);
        assert.equal(raw.company, derived.company);
        assert.equal(raw.side, derived.side ?? null);
      };
      await compete(raced, 0);
      const untouchedPo = await row(po);
      await compete(fto, 1);
      assert.deepEqual(await row(po), untouchedPo);
      const before = await row(legacy);
      await assert.rejects(store.save(legacy, { assignmentToken: "1234A", expectedVersion: 7 }), versionConflict);
      assert.deepEqual(await row(legacy), before);
      for (const [assignmentToken, expectedVersion] of [["1234A", 8], ["9151E-2", 9]] as const) {
        const saved = await store.save(legacy, { assignmentToken, expectedVersion });
        assert.deepEqual(saved.identity, parseOperationalIdentity(assignmentToken));
        assert.equal((await row(legacy)).cruiser_number, "9150");
      }
      assert.equal((await row(legacy)).version, 10);
    });

    await t.test("runtime cannot rewrite authority, grant roster access or remove profile evidence", async () => {
      for (const table of ["assignments", "coordinator_directory"]) {
        for (const statement of [
          `UPDATE agency_training.${table} SET active=false`,
          `DELETE FROM agency_training.${table}`,
          `TRUNCATE agency_training.${table}`,
          `ALTER TABLE agency_training.${table} OWNER TO profile_runtime`,
        ]) await assert.rejects(limited.query(statement), permissionDenied);
        // PostgreSQL may warn instead of throwing for GRANT without grant
        // option. Check effective rights, not just the command result.
        await limited.query(`GRANT UPDATE ON agency_training.${table} TO profile_runtime`);
        const rights = (await limited.query(`SELECT
          has_table_privilege(current_user,$1,'UPDATE') AS can_update,
          has_any_column_privilege(current_user,$1,'UPDATE') AS can_update_column,
          has_table_privilege(current_user,$1,'INSERT') AS can_insert,
          has_table_privilege(current_user,$1,'DELETE') AS can_delete,
          has_table_privilege(current_user,$1,'TRUNCATE') AS can_truncate`,
        [`agency_training.${table}`])).rows[0];
        assert.deepEqual(rights, { can_update: false, can_update_column: false, can_insert: false, can_delete: false, can_truncate: false });
      }
      const profilesBefore = (await db.query("SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash")).rows;
      for (const statement of [
        "DELETE FROM agency_training.operational_profiles",
        "TRUNCATE agency_training.operational_profiles",
        "UPDATE agency_training.operational_profiles SET cruiser_number='FORGED'",
        "UPDATE agency_training.operational_profiles SET subject_hash=repeat('f',64)",
      ]) await assert.rejects(limited.query(statement), permissionDenied);
      assert.deepEqual((await db.query("SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash")).rows, profilesBefore);
      assert.deepEqual((await db.query("SELECT * FROM agency_training.assignments")).rows, rosterBefore);
      assert.deepEqual((await db.query("SELECT * FROM agency_training.coordinator_directory")).rows, directoryBefore);
    });
  } finally {
    await runtime?.end();
    await owner?.end();
    if (started) execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
});
