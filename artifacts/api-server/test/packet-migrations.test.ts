import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('the draft upgrade preserves released history and audit types without submitting unreviewed uploads',async()=>{
  const db=new PGlite();
  const migration=(name:string)=>readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8');
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
    await db.exec(await migration('agency-training-packet-guards.sql'));
    const rows=await db.query<{id:string;submission_status:string;report:{narrative:string}}>(
      'SELECT id,submission_status,report FROM agency_training.packets ORDER BY id');
    assert.deepEqual(rows.rows.map(row=>[row.id,row.submission_status]),[
      ['acknowledged','submitted'],['draft','local_draft_pending'],['released','submitted'],['withdrawn','submitted'],
    ]);
    assert.ok(rows.rows.every(row=>row.report.narrative==='Keep Mixed CASE'));
    assert.equal((await db.query('SELECT * FROM agency_training.packet_submissions')).rows.length,0);
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
