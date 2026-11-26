import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir, readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const freshInstallMigrations = [
  'agency-training.sql',
  'agency-training-packet-review.sql',
  'agency-training-po-totals-review-upgrade.sql',
  'agency-training-staff-class-access.sql',
  'agency-training-assignment-transitions.sql',
  'agency-training-packet-guards.sql',
  'agency-training-phase-extensions.sql',
  'agency-training-phase-extension-denial-explanations.sql',
  'agency-training-legacy-coordinator-reconciliation.sql',
  'operational-profiles.sql',
  'operational-profile-optional-sides.sql',
  'operational-profile-history.sql',
  'operational-profile-clear.sql',
] as const;

const legacyUpgradeMigrations = [
  'agency-training-release-upgrade.sql',
  'agency-training-draft-finalization.sql',
  'agency-training-packet-review.sql',
  'agency-training-po-totals-review-upgrade.sql',
  'agency-training-staff-class-access.sql',
  'agency-training-assignment-transitions.sql',
  'agency-training-packet-guards.sql',
  'agency-training-phase-extensions.sql',
  'agency-training-phase-extension-denial-explanations.sql',
  'agency-training-legacy-coordinator-reconciliation.sql',
  'operational-profiles.sql',
  'operational-profile-optional-sides.sql',
  'operational-profile-history.sql',
  'operational-profile-clear.sql',
] as const;

const migration = (name: string) =>
  readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

async function applyMigrations(db: PGlite, names: readonly string[], state: string) {
  for (const name of names) {
    try {
      await db.exec(await migration(name));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${name} failed for ${state}: ${detail}`, {cause: error});
    }
  }
}

async function createLegacyPacketSchema(db: PGlite) {
  await db.exec(`
    CREATE SCHEMA agency_training;
    CREATE TABLE agency_training.assignments (
      id uuid PRIMARY KEY,
      class_name text NOT NULL,
      phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
      fto_id_hash char(64) NOT NULL,
      fto_badge_hash char(64) NOT NULL,
      fto_name text NOT NULL,
      po_id_hash char(64) NOT NULL,
      po_badge_hash char(64) NOT NULL,
      po_name text NOT NULL,
      coordinator_id_hash char(64),
      starts_on date NOT NULL,
      ends_on date NOT NULL,
      active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE agency_training.packet_assignments (
      packet_id text PRIMARY KEY,
      assignment_id uuid NOT NULL REFERENCES agency_training.assignments(id),
      record_date date NOT NULL,
      active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE agency_training.packets (
      id text PRIMARY KEY REFERENCES agency_training.packet_assignments(packet_id),
      assignment_id uuid NOT NULL REFERENCES agency_training.assignments(id),
      record_date date NOT NULL,
      phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
      operation_id uuid UNIQUE NOT NULL,
      content_hash char(64) NOT NULL,
      server_version integer NOT NULL DEFAULT 1 CHECK (server_version >= 1),
      released_to_po boolean NOT NULL DEFAULT false,
      report jsonb NOT NULL,
      committed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE agency_training.packet_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      request_id uuid NOT NULL,
      packet_id text,
      actor_hash char(64) NOT NULL,
      actor_role text NOT NULL,
      client_ip_hash char(64) NOT NULL,
      event_type text NOT NULL CHECK (event_type IN ('READ','COMMIT')),
      record_count integer NOT NULL CHECK (record_count BETWEEN 0 AND 100)
    );
  `);
}

test('the draft upgrade preserves released history and audit types without submitting unreviewed uploads',async()=>{
  const db=new PGlite();
  try{
    await db.exec(await migration('agency-training.sql'));
    await db.exec(`ALTER TABLE agency_training.packets DROP COLUMN submission_status,
      DROP COLUMN finalization_operation_id,DROP COLUMN submitted_at;
      ALTER TABLE agency_training.packets DROP CONSTRAINT packets_server_version_check,
      ADD CONSTRAINT packets_server_version_check CHECK(server_version=1);`);
    const assignment=randomUUID(),hash='a'.repeat(64);
    await db.query(`INSERT INTO agency_training.assignments
      (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,starts_on,ends_on)
      VALUES($1,'TEST ONLY',1,$2,$2,'Test FTO',$2,$2,'Test PO','2026-01-01','2026-12-31')`,[assignment,hash]);
    for(const id of ['draft','released','withdrawn','acknowledged']){
      await db.query(`INSERT INTO agency_training.packet_assignments(packet_id,assignment_id,record_date)
        VALUES($1,$2,'2026-11-23')`,[id,assignment]);
      await db.query(`INSERT INTO agency_training.packets
        (id,assignment_id,record_date,phase,operation_id,content_hash,report,released_to_po,released_at,
         released_by_hash,withdrawn_at,withdrawn_by_hash,withdrawal_reason)
        VALUES($1,$2,'2026-11-23',1,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
        [id,assignment,randomUUID(),hash,JSON.stringify({id,narrative:'Keep Mixed CASE'}),
          id==='released'||id==='acknowledged',id==='released'||id==='acknowledged'?'2026-11-23T12:00:00Z':null,
          id==='released'||id==='acknowledged'?hash:null,id==='withdrawn'?'2026-11-23T12:30:00Z':null,
          id==='withdrawn'?hash:null,id==='withdrawn'?'Keep the original withdrawal':null]);
    }
    await db.query(`INSERT INTO agency_training.packet_acknowledgments(packet_id,actor_hash,content_hash,comments)
      VALUES('acknowledged',$1,$1,'Original acknowledgment')`,[hash]);
    for(const event of ['COMMIT','RELEASE','WITHDRAW','ACKNOWLEDGE']){
      await db.query(`INSERT INTO agency_training.packet_events
        (request_id,actor_hash,actor_role,client_ip_hash,event_type,record_count) VALUES($1,$2,'FTO_COORDINATOR',$2,$3,1)`,
        [randomUUID(),hash,event]);
    }
    await db.exec(await migration('agency-training-draft-finalization.sql'));
    await db.exec(await migration('agency-training-packet-review.sql'));
    await db.exec(await migration('agency-training-po-totals-review-upgrade.sql'));
    await db.exec(await migration('agency-training-staff-class-access.sql'));
    await db.exec(await migration('agency-training-assignment-transitions.sql'));
    await db.exec(await migration('agency-training-packet-guards.sql'));
    const rows=await db.query<{id:string;submission_status:string;report:{narrative:string}}>(
      'SELECT id,submission_status,report FROM agency_training.packets ORDER BY id');
    assert.deepEqual(rows.rows.map(row=>[row.id,row.submission_status]),[
      ['acknowledged','submitted'],['draft','local_draft_pending'],['released','submitted'],['withdrawn','submitted'],
    ]);
    assert.ok(rows.rows.every(row=>row.report.narrative==='Keep Mixed CASE'));
    assert.equal((await db.query('SELECT * FROM agency_training.packet_submissions')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM agency_training.staff_class_read_grants')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM agency_training.packet_events')).rows.length,4);
    assert.equal((await db.query<{comments:string}>('SELECT comments FROM agency_training.packet_acknowledgments')).rows[0].comments,'Original acknowledgment');
    assert.equal((await db.query<{po_id:string|null}>('SELECT po_id FROM agency_training.assignments')).rows[0].po_id,null);
    await assert.rejects(db.query("UPDATE agency_training.packets SET report='{}'::jsonb WHERE id='released'"),/immutable/);
    await assert.rejects(db.query("UPDATE agency_training.packets SET submission_status='local_draft_pending' WHERE id='withdrawn'"),/permanent/);
    await db.query("UPDATE agency_training.packets SET report='{\"narrative\":\"Edited draft\"}'::jsonb,server_version=2 WHERE id='draft'");
    for(const event of ['DRAFT_SYNC','SUBMIT']){
      await db.query(`INSERT INTO agency_training.packet_events
        (request_id,actor_hash,actor_role,client_ip_hash,event_type,record_count) VALUES($1,$2,'FTO',$2,$3,1)`,
        [randomUUID(),hash,event]);
    }
  }finally{await db.close();}
});

test('the complete ordered migration sequence installs a fresh database', async () => {
  const db = new PGlite();
  const state = 'fresh, empty database';
  try {
    const migrationFiles = (await readdir(new URL('../migrations/', import.meta.url)))
      .filter(name => name.endsWith('.sql'))
      .sort();
    const declaredMigrations = [...new Set([...freshInstallMigrations, ...legacyUpgradeMigrations])].sort();
    assert.deepEqual(
      declaredMigrations,
      migrationFiles,
      `Migration sequences do not account for every SQL migration file (${state}).`,
    );
    await applyMigrations(db, freshInstallMigrations, state);
    const relations = await db.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='agency_training' AND table_type='BASE TABLE'`,
    );
    const tables = new Set(relations.rows.map(({table_name}) => table_name));
    for (const table of [
      'assignments',
      'packet_assignments',
      'packets',
      'packet_events',
      'packet_submissions',
      'assignment_transitions',
      'phase_extension_requests',
      'operational_profiles',
      'operational_profile_history',
    ]) {
      assert.ok(tables.has(table), `Migration sequence for ${state} did not create ${table}.`);
    }

    const guards = await db.query<{trigger_name: string}>(
      `SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema='agency_training'`,
    );
    const triggerNames = new Set(guards.rows.map(({trigger_name}) => trigger_name));
    assert.ok(triggerNames.has('protect_packet_snapshot'), `Migration sequence for ${state} missed the packet snapshot guard.`);
    assert.ok(triggerNames.has('assignment_transition_audit_immutable'), `Migration sequence for ${state} missed the assignment transition audit guard.`);
    assert.ok(triggerNames.has('operational_profile_history_no_rewrite'), `Migration sequence for ${state} missed the profile history guard.`);
  } finally {
    await db.close();
  }
});

test('the supported legacy upgrade preserves packet and audit records', async () => {
  const db = new PGlite();
  const state = 'existing legacy agency-training database';
  const assignmentId = randomUUID();
  const operationId = randomUUID();
  const actorHash = 'b'.repeat(64);
  try {
    await createLegacyPacketSchema(db);
    await db.query(
      `INSERT INTO agency_training.assignments
        (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,starts_on,ends_on)
       VALUES($1,'LEGACY CLASS',2,$2,$2,'Legacy FTO',$2,$2,'Legacy recruit','2026-01-01','2026-12-31')`,
      [assignmentId, actorHash],
    );
    await db.query(
      `INSERT INTO agency_training.packet_assignments(packet_id,assignment_id,record_date)
       VALUES('legacy-packet',$1,'2026-11-24')`,
      [assignmentId],
    );
    await db.query(
      `INSERT INTO agency_training.packets
        (id,assignment_id,record_date,phase,operation_id,content_hash,released_to_po,report)
       VALUES('legacy-packet',$1,'2026-11-24',2,$2,$3,true,$4::jsonb)`,
      [assignmentId, operationId, 'c'.repeat(64), JSON.stringify({narrative: 'Preserve Legacy Case'})],
    );
    await db.query(
      `INSERT INTO agency_training.packet_events
        (request_id,packet_id,actor_hash,actor_role,client_ip_hash,event_type,record_count)
       VALUES($1,'legacy-packet',$2,'FTO',$2,'COMMIT',1)`,
      [randomUUID(), actorHash],
    );

    await applyMigrations(db, legacyUpgradeMigrations, state);

    const packet = await db.query<{
      id: string;
      released_to_po: boolean;
      submission_status: string;
      report: {narrative: string};
      operation_id: string;
    }>('SELECT id,released_to_po,submission_status,report,operation_id FROM agency_training.packets');
    assert.deepEqual(packet.rows, [{
      id: 'legacy-packet',
      released_to_po: false,
      submission_status: 'local_draft_pending',
      report: {narrative: 'Preserve Legacy Case'},
      operation_id: operationId,
    }], `Upgrade sequence for ${state} changed or lost packet data.`);
    assert.equal(
      (await db.query<{count: number}>('SELECT count(*)::int AS count FROM agency_training.packet_events')).rows[0].count,
      1,
      `Upgrade sequence for ${state} lost audit events.`,
    );
    assert.equal(
      (await db.query<{state: string}>('SELECT state FROM agency_training.packet_submissions')).rows.length,
      0,
      `Upgrade sequence for ${state} promoted an unreviewed packet.`,
    );
    assert.equal(
      (await db.query<{table_name: string}>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='agency_training'
           AND table_name IN ('packet_review_events','phase_extension_requests','operational_profile_history')`,
      )).rows.length,
      3,
      `Upgrade sequence for ${state} did not install the full release schema.`,
    );
  } finally {
    await db.close();
  }
});
