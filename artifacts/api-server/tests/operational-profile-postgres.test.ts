import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import pg from "pg";
import express from "express";
import { GetOperationalProfileResponse } from "@workspace/api-zod";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { createOperationalProfileStore } from "../src/lib/operational-profile-store.js";
import { createOperationalProfileRouter } from "../src/routes/operational-profile.js";
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
  let server: Server | undefined;
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
    let requestIdentity = legacy;
    const app = express();
    app.use(express.json());
    app.use(createOperationalProfileRouter((_req, res, next) => {
      res.locals.agencyIdentity = requestIdentity;
      next();
    }, () => store));
    const httpServer = server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      httpServer.once("listening", resolve);
      httpServer.once("error", reject);
    });
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/v1/account/operational-profile`;
    const put = (assignmentToken: string, expectedVersion: number) => fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentToken, expectedVersion }),
    });
    const profileRows = async () => (await db.query(
      "SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash",
    )).rows;
    const assertRejectedSave = async (assignmentToken: string, expectedVersion: number) => {
      const before = await profileRows();
      const readableBefore = await store.read(requestIdentity);
      const response = await put(assignmentToken, expectedVersion);
      assert.equal(response.ok, false);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body: unknown = await response.json();
      assert.deepEqual(body, { error: "AGENCY_STORAGE_UNAVAILABLE" });
      assert.equal(GetOperationalProfileResponse.safeParse(body).success, false);
      assert.deepEqual(await profileRows(), before);
      const readResponse = await fetch(url);
      assert.equal(readResponse.status, 200);
      assert.deepEqual(GetOperationalProfileResponse.parse(await readResponse.json()), readableBefore);
    };
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

    await t.test("HTTP saves denied district_token UPDATE never return a saved profile or change any stored column", async () => {
      const rights = (await limited.query(`SELECT
        has_column_privilege(current_user,'agency_training.operational_profiles','district_token','UPDATE') AS district,
        has_column_privilege(current_user,'agency_training.operational_profiles','assignment_token','UPDATE') AS assignment`)).rows[0];
      assert.deepEqual(rights, { district: false, assignment: true });
      requestIdentity = legacy;
      for (const assignmentToken of ["1234A", "9151E-2"]) {
        await assertRejectedSave(assignmentToken, 8);
      }
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

    await t.test("HTTP saves denied district_token INSERT never return a saved profile or create a row", async () => {
      const rights = (await limited.query(`SELECT
        has_column_privilege(current_user,'agency_training.operational_profiles','district_token','INSERT') AS district,
        has_column_privilege(current_user,'agency_training.operational_profiles','assignment_token','INSERT') AS assignment`)).rows[0];
      assert.deepEqual(rights, { district: false, assignment: true });
      for (const identity of [fto, po]) {
        requestIdentity = identity;
        for (const assignmentToken of ["9150E", "9150E-2"]) {
          await assertRejectedSave(assignmentToken, 0);
          assert.equal(await row(identity), undefined);
        }
      }
    });

    // Execute the exact documented grants so documentation and the permission
    // fixture cannot quietly diverge. Replace only the example role identifier.
    const documentation = readFileSync(new URL("../../../docs/OPERATIONAL_PROFILES.md", import.meta.url), "utf8");
    const grants = documentation.match(/<!-- profile-runtime-grants -->\s*```sql\n([\s\S]*?)```/);
    assert.ok(grants, "documented profile runtime grants must exist");
    await db.query(grants[1].replaceAll("agency_runtime", "profile_runtime"));

    await t.test("the same HTTP route and real store save successfully after restoring documented grants", async () => {
      requestIdentity = { ...fto, id: "FICTIONAL-HTTP-FTO" };
      for (const [assignmentToken, expectedVersion] of [["9150E", 0], ["1234A-2", 1]] as const) {
        const response = await put(assignmentToken, expectedVersion);
        assert.equal(response.status, 200);
        const saved = GetOperationalProfileResponse.parse(await response.json());
        assert.deepEqual(saved, await store.read(requestIdentity));
        assert.equal(saved.version, expectedVersion + 1);
        assert.deepEqual(saved.identity, parseOperationalIdentity(assignmentToken));
        const raw = await row(requestIdentity);
        assert.equal(raw.assignment_token, assignmentToken);
        assert.equal(raw.version, saved.version);
        assert.equal(raw.district_token, saved.identity?.districtToken);
        assert.equal(raw.cad_unit, saved.identity?.cadUnit);
        assert.equal(raw.company, saved.identity?.company);
        assert.equal(raw.side, saved.identity?.side ?? null);
      }
    });

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

    await t.test("lost HTTP save responses preserve committed creation and optional-side edits until explicit reload", async () => {
      for (const role of ["FTO", "PO"] as const) {
        const identity: AgencyIdentity = { id: `FICTIONAL-LOST-RESPONSE-${role}`, badge: `TEST-LOST-${role}`, role };
        let dropResponse = false;
        let writes = 0;
        let dropped = 0;
        const app = express();
        app.use(express.json());
        app.use((_req, res, next) => {
          const json = res.json.bind(res);
          res.json = body => {
            if (dropResponse && _req.method === "PUT" && res.statusCode === 200) {
              // The router calls json only AFTER the real store's SQL completed.
              dropResponse = false;
              dropped++;
              res.destroy();
              return res;
            }
            return json(body);
          };
          next();
        });
        app.use(createOperationalProfileRouter((_req, res, next) => {
          res.locals.agencyIdentity = identity;
          next();
        }, () => ({
          read: store.read,
          save: (...args) => { writes++; return store.save(...args); },
        })));
        const server = app.listen(0, "127.0.0.1");
        await new Promise<void>(resolve => server.once("listening", resolve));
        const address = server.address();
        assert.ok(address && typeof address === "object");
        const url = `http://127.0.0.1:${address.port}/v1/account/operational-profile`;
        const put = (body: unknown) => fetch(url, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        try {
          let loaded = await (await fetch(url)).json();
          assert.equal(loaded.version, 0);
          assert.equal(loaded.identity, null);
          const tokens = role === "FTO"
            ? ["9150E", "9150E-1", "9150E-2", "9150E"]
            : ["1234A-2", "1234A", "1234A-1", "1234A-2"];
          for (const assignmentToken of tokens) {
            const staleInput = { assignmentToken, expectedVersion: loaded.version };
            const before = (await db.query("SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash")).rows;
            const writesBefore = writes;
            dropResponse = true;
            await assert.rejects(put(staleInput), TypeError);
            assert.equal(dropResponse, false, "Response was dropped only after a successful commit");
            assert.equal(writes, writesBefore + 1, "A lost response must not automatically retry a PUT");
            const committed = await row(identity);
            const derived = parseOperationalIdentity(assignmentToken);
            assert.equal(committed.version, loaded.version + 1);
            assert.equal(committed.assignment_token, assignmentToken);
            assert.equal(committed.district_token, derived.districtToken);
            assert.equal(committed.cad_unit, derived.cadUnit);
            assert.equal(committed.company, derived.company);
            assert.equal(committed.side, derived.side ?? null);
            assert.equal(committed.cruiser_number, null);
            const committedRows = (await db.query("SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash")).rows;
            assert.deepEqual(committedRows.filter(value => value.subject_hash !== committed.subject_hash),
              before.filter(value => value.subject_hash !== committed.subject_hash));
            assert.equal(committedRows.filter(value => value.subject_hash === committed.subject_hash).length, 1);
            for (const retryToken of [assignmentToken, "9999D-1"]) {
              const retry = await put({ ...staleInput, assignmentToken: retryToken });
              assert.equal(retry.status, 409);
              assert.deepEqual(await retry.json(), { error: versionConflict.code });
            }
            const reload = await fetch(url);
            assert.equal(reload.status, 200);
            assert.equal(reload.headers.get("cache-control"), "no-store");
            loaded = await reload.json();
            assert.deepEqual(loaded, JSON.parse(JSON.stringify(await store.read(identity))),
              "HTTP reload returns the committed store result with JSON-serialized timestamps");
            assert.deepEqual(loaded.identity, derived);
            assert.equal(loaded.version, staleInput.expectedVersion + 1);
            const retryAfterReload = await put(staleInput);
            assert.equal(retryAfterReload.status, 409, "Reload cannot make the former version valid again");
            assert.deepEqual(await retryAfterReload.json(), { error: versionConflict.code });
            assert.deepEqual((await db.query("SELECT * FROM agency_training.operational_profiles ORDER BY subject_hash")).rows,
              committedRows, "Rejected retries and reload leave all rows and timestamps unchanged");
          }
          assert.equal(dropped, tokens.length);
          assert.equal(writes, tokens.length * 4);
        } finally {
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
      }
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
    if (server) await new Promise<void>((resolve, reject) =>
      server!.close(error => error ? reject(error) : resolve()));
    await runtime?.end();
    await owner?.end();
    if (started) execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
});
