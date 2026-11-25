import type pg from "pg";
import { randomUUID } from "node:crypto";
import type { PacketSubmission, PacketReviewActionInput } from "@workspace/api-zod";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { PacketError } from "./packet-errors.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

const columns=`s.id,s.packet_id,s.packet_version,s.coordinator_id,d.name AS coordinator_name,
 s.state,(s.report->>'date') AS record_date,(s.report->>'recruitName') AS po_name,
 (s.report->>'ftoName') AS fto_name,s.submitted_at::text,s.acknowledged_at::text,
 s.reviewed_at::text,s.review_note`;
const joins=`FROM agency_training.packet_submissions s
 JOIN agency_training.coordinator_directory d ON d.id=s.coordinator_id
 JOIN agency_training.po_coordinators pc ON pc.po_id=s.po_id
 JOIN agency_training.packet_assignments pa ON pa.packet_id=s.packet_id AND pa.active
 JOIN agency_training.assignments a ON a.id=pa.assignment_id AND a.active AND a.po_id_hash=pc.po_id_hash
 JOIN agency_training.packets p ON p.id=s.packet_id AND p.assignment_id=a.id`;
const scope=`(($1='FTO' AND s.fto_id=$2 AND a.fto_id=$2 AND a.fto_badge=$3
   AND a.fto_id_hash=$5 AND a.fto_badge_hash=$6)
 OR ($1='PO' AND s.po_id=$2 AND a.po_id=$2 AND a.po_badge=$3
   AND a.po_id_hash=$5 AND a.po_badge_hash=$6
   AND p.released_to_po AND p.withdrawn_at IS NULL AND p.submission_status='submitted'
   AND s.state='approved' AND s.packet_version=p.server_version
   AND (s.report-'status')=(p.report-'status'))
 OR ($1='FTO_COORDINATOR' AND pc.coordinator_id=$2))`;

async function transaction<T>(pool:pg.Pool,run:(client:pg.PoolClient)=>Promise<T>):Promise<T> {
  const client=await pool.connect();
  try {await client.query("BEGIN");const result=await run(client);await client.query("COMMIT");return result;}
  catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}
async function event(client:pg.PoolClient,identity:AgencyIdentity,submissionId:string|null,action:string,note="") {
  await client.query(`INSERT INTO agency_training.packet_review_events
    (submission_id,actor_hash,action,note) VALUES ($1,$2,$3,$4)`,
    [submissionId,hashUserIdentifier(identity.id),action,note]);
}
export async function registerPacketSubmission(
  client:pg.PoolClient,identity:AgencyIdentity,input:{
    id:string;version:number;poId:string;poBadge:string;report:Record<string,unknown>;
  },
):Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`po:${input.poId}`]);
  // Assignment changes take this same per-PO lock. Do not require UPDATE
  // authority on the trusted Coordinator mapping just to read its selection.
  const result=await client.query<{coordinator_id:string}>(
    `SELECT pc.coordinator_id FROM agency_training.po_coordinators pc
     JOIN LATERAL agency_training.lock_active_packet_coordinator(pc.coordinator_id) d ON true
     WHERE pc.po_id=$1 AND pc.po_badge=$2 AND pc.po_id_hash=$3`,
     [input.poId,input.poBadge,hashUserIdentifier(input.poId)]);
  const coordinator=result.rows[0]?.coordinator_id;
  if(!coordinator) throw new PacketError(422,"ASSIGNED_COORDINATOR_REQUIRED");
  const existing=await client.query(`SELECT id FROM agency_training.packet_submissions
    WHERE packet_id=$1 AND packet_version=$2`,[input.id,input.version]);
  if(existing.rows.length) throw new PacketError(409,"NEW_PACKET_REVISION_REQUIRED");
  const id=randomUUID();
  await client.query(`INSERT INTO agency_training.packet_submissions
    (id,packet_id,packet_version,po_id,fto_id,coordinator_id,report)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [id,input.id,input.version,input.poId,identity.id,coordinator,JSON.stringify({...input.report,status:"locked"})]);
  await event(client,identity,id,"SUBMITTED");
}

export function createPacketReviewStore(pool:pg.Pool) {
  async function pending(identity:AgencyIdentity,client:pg.Pool|pg.PoolClient=pool) {
    if(identity.role!=="FTO_COORDINATOR") return {count:0,item:null};
    const result=await client.query<PacketSubmission&{pending_count:string}>(
      `SELECT ${columns},count(*) OVER()::text AS pending_count ${joins}
       WHERE pc.coordinator_id=$1 AND s.coordinator_id=$1 AND s.state='submitted'
       ORDER BY s.submitted_at,s.id LIMIT 1`,[identity.id]);
    const row=result.rows[0];
    if(!row) return {count:0,item:null};
    const {pending_count,...item}=row;
    return {count:Number(pending_count),item};
  }
  return {
    pending,
    async context(identity:AgencyIdentity) {
      const [directory,assignments,unread]=await Promise.all([
        pool.query(`SELECT id,name FROM agency_training.coordinator_directory WHERE active ORDER BY name,id`),
        pool.query(`SELECT pc.po_id,pc.po_badge,pc.coordinator_id,pc.revision
          FROM agency_training.po_coordinators pc
          WHERE ($1='PO' AND pc.po_id=$2 AND pc.po_badge=$3)
             OR ($1='FTO_COORDINATOR' AND pc.coordinator_id=$2)
          UNION
          SELECT DISTINCT a.po_id,a.po_badge,a.coordinator_id,0 AS revision
          FROM agency_training.assignments a
          WHERE $1='FTO_COORDINATOR' AND a.coordinator_id=$2 AND a.active AND a.coordinator_id_hash=$4
            AND a.po_id IS NOT NULL AND a.po_badge IS NOT NULL
            AND NOT EXISTS(SELECT 1 FROM agency_training.po_coordinators pc WHERE pc.po_id=a.po_id)`,
           [identity.role,identity.id,identity.badge,hashUserIdentifier(identity.id)]),
        pending(identity),
      ]);
      return {available:true,account_id:identity.id,role:identity.role,coordinators:directory.rows,
        assignments:assignments.rows,pending_count:unread.count,pending:unread.item};
    },
    async assign(identity:AgencyIdentity,input:{po_id:string;coordinator_id:string;expected_revision:number}) {
      return transaction(pool,async client=>{
        if(!["PO","FTO_COORDINATOR"].includes(identity.role)) throw new PacketError(403,"ASSIGNMENT_FORBIDDEN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`po:${input.po_id}`]);
        const previous=await client.query<{po_id:string;po_badge:string;coordinator_id:string;revision:number}>(
          "SELECT * FROM agency_training.po_coordinators WHERE po_id=$1 FOR UPDATE",[input.po_id]);
        const prior=previous.rows[0];
        let badge=identity.badge;
        if(identity.role==="PO") {
          if(identity.id!==input.po_id||prior) throw new PacketError(403,"COORDINATOR_EDIT_REQUIRES_FTO_COORDINATOR");
        } else {
          const roster=await client.query<{po_badge:string}>(`SELECT po_badge FROM agency_training.assignments
            WHERE po_id=$1 AND coordinator_id=$2 AND active AND po_id_hash=$3 AND coordinator_id_hash=$4 LIMIT 1`,
            [input.po_id,identity.id,hashUserIdentifier(input.po_id),hashUserIdentifier(identity.id)]);
          if(prior ? prior.coordinator_id!==identity.id : !roster.rows[0])
            throw new PacketError(403,"ASSIGNMENT_OUT_OF_SCOPE");
          badge=prior?.po_badge??roster.rows[0].po_badge;
        }
        if((prior?.revision??0)!==input.expected_revision) throw new PacketError(409,"ASSIGNMENT_VERSION_CONFLICT");
        const target=await client.query(`SELECT id FROM agency_training.lock_active_packet_coordinator($1)`,[input.coordinator_id]);
        if(!target.rows.length) throw new PacketError(422,"COORDINATOR_UNAVAILABLE");
        if(prior?.coordinator_id===input.coordinator_id) return prior;
        const saved=await client.query(`INSERT INTO agency_training.po_coordinators
          (po_id,po_badge,coordinator_id,revision,po_id_hash) VALUES ($1,$2,$3,1,$4)
          ON CONFLICT(po_id) DO UPDATE SET coordinator_id=EXCLUDED.coordinator_id,
            revision=agency_training.po_coordinators.revision+1,updated_at=now()
          RETURNING po_id,po_badge,coordinator_id,revision`,[input.po_id,badge,input.coordinator_id,hashUserIdentifier(input.po_id)]);
        // Pending work transfers to the new inbox and must be acknowledged anew.
        // Approved/correction snapshots and the immutable event history remain intact.
        const moved=await client.query<{id:string}>(`UPDATE agency_training.packet_submissions
          SET coordinator_id=$2,state='submitted',acknowledged_at=NULL
          WHERE po_id=$1 AND state IN ('submitted','acknowledged') RETURNING id`,
          [input.po_id,input.coordinator_id]);
        await event(client,identity,null,"COORDINATOR_ASSIGNED",input.po_id);
        for(const row of moved.rows) await event(client,identity,row.id,"REASSIGNED");
        return saved.rows[0];
      });
    },
    async list(identity:AgencyIdentity,offset:number) {
      const result=await pool.query<PacketSubmission>(
        `SELECT ${columns} ${joins} WHERE ${scope}
          AND NOT EXISTS (SELECT 1 FROM agency_training.packet_submissions newer
            WHERE newer.packet_id=s.packet_id AND newer.packet_version>s.packet_version)
         ORDER BY s.submitted_at DESC,s.id DESC LIMIT 51 OFFSET $4`,
         [identity.role,identity.id,identity.badge,offset,hashUserIdentifier(identity.id),hashUserIdentifier(identity.badge)]);
      return {items:result.rows.slice(0,50),has_more:result.rows.length>50,next_offset:offset+Math.min(50,result.rows.length)};
    },
    async detail(identity:AgencyIdentity,id:string) {
      return transaction(pool,async client=>{
        const result=await client.query<PacketSubmission&{report:Record<string,unknown>}>(
          `SELECT ${columns},s.report ${joins} WHERE ${scope} AND s.id=$4`,
           [identity.role,identity.id,identity.badge,id,hashUserIdentifier(identity.id),hashUserIdentifier(identity.badge)]);
        if(!result.rows[0]) throw new PacketError(404,"SUBMISSION_NOT_FOUND");
        const {report,...submission}=result.rows[0];
        const history=await client.query(`SELECT e.action,e.occurred_at::text,e.note
          FROM agency_training.packet_review_events e
          JOIN agency_training.packet_submissions s ON s.id=e.submission_id
          WHERE s.packet_id=$1 AND ($2<>'PO' OR e.submission_id=$3)
          ORDER BY e.id`,[submission.packet_id,identity.role,id]);
        await event(client,identity,id,"OPENED_FOR_REVIEW");
        return {submission,report,history:history.rows};
      });
    },
    async act(identity:AgencyIdentity,id:string,input:PacketReviewActionInput) {
      if(identity.role!=="FTO_COORDINATOR") throw new PacketError(403,"REVIEW_FORBIDDEN");
      return transaction(pool,async client=>{
        const ownership=await client.query<{packet_id:string;po_id:string}>(
          `SELECT s.packet_id,s.po_id ${joins} WHERE ${scope} AND s.id=$4`,
          [identity.role,identity.id,identity.badge,id,hashUserIdentifier(identity.id),hashUserIdentifier(identity.badge)]);
        if(!ownership.rows[0]) throw new PacketError(404,"SUBMISSION_NOT_FOUND");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[ownership.rows[0].packet_id]);
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`po:${ownership.rows[0].po_id}`]);
        const result=await client.query<PacketSubmission>(
          `SELECT ${columns} ${joins} WHERE ${scope} AND s.id=$4 AND s.coordinator_id=$2
           FOR UPDATE OF s,pc`,[identity.role,identity.id,identity.badge,id,hashUserIdentifier(identity.id),hashUserIdentifier(identity.badge)]);
        const current=result.rows[0];
        if(!current) throw new PacketError(404,"SUBMISSION_NOT_FOUND");
        const prior=await client.query<{actor_hash:string;submission_id:string;action:string;note:string;receipt:PacketSubmission}>(
          "SELECT * FROM agency_training.packet_review_operations WHERE operation_id=$1",[input.operation_id]);
        if(prior.rows[0]) {
          const retry=prior.rows[0];
          if(retry.actor_hash!==hashUserIdentifier(identity.id)||retry.submission_id!==id||
            retry.action!==input.action||retry.note!==input.note) throw new PacketError(409,"REVIEW_OPERATION_CONFLICT");
          return retry.receipt;
        }
        if(input.action==="acknowledge") {
          if(current.state!=="submitted") {
            // Acknowledgment on another device is already durable.
            if(current.state!=="acknowledged") throw new PacketError(409,"REVIEW_STATE_CHANGED");
          } else {
            await client.query(`UPDATE agency_training.packet_submissions SET state='acknowledged',
              acknowledged_at=now() WHERE id=$1`,[id]);
            await event(client,identity,id,"ACKNOWLEDGED");
          }
        } else {
          if((await pending(identity,client)).count) throw new PacketError(409,"PACKET_ACKNOWLEDGMENT_REQUIRED");
          if(current.state!=="acknowledged") throw new PacketError(409,"ACKNOWLEDGE_BEFORE_REVIEW");
          const opened=await client.query(`SELECT 1 FROM agency_training.packet_review_events
            WHERE submission_id=$1 AND actor_hash=$2 AND action='OPENED_FOR_REVIEW' LIMIT 1`,
            [id,hashUserIdentifier(identity.id)]);
          if(!opened.rows.length) throw new PacketError(422,"OPEN_PACKET_BEFORE_APPROVAL");
          if(input.action==="return"&&!input.note.trim()) throw new PacketError(422,"CORRECTION_REASON_REQUIRED");
          await client.query(`UPDATE agency_training.packet_submissions SET state=$2,
            reviewed_at=now(),review_note=$3 WHERE id=$1`,
            [id,input.action==="approve"?"approved":"correction_requested",input.note]);
          if(input.action==="return") await client.query(`UPDATE agency_training.packets
            SET submission_status='local_draft_pending' WHERE id=$1 AND server_version=$2`,
            [current.packet_id,current.packet_version]);
          await event(client,identity,id,input.action==="approve"?"APPROVED":"CORRECTION_REQUESTED",input.note);
        }
        const saved=await client.query<PacketSubmission>(`SELECT ${columns} ${joins} WHERE s.id=$1`,[id]);
        const receipt=saved.rows[0];
        await client.query(`INSERT INTO agency_training.packet_review_operations
          (operation_id,actor_hash,submission_id,action,note,receipt) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
          [input.operation_id,hashUserIdentifier(identity.id),id,input.action,input.note,JSON.stringify(receipt)]);
        return receipt;
      });
    },
  };
}
export type PacketReviewStore=ReturnType<typeof createPacketReviewStore>;
let store:PacketReviewStore|undefined;
export function getPacketReviewStore():PacketReviewStore|null {
  const pool=getAgencyDatabasePool();
  if(!pool) return null;
  return store??=createPacketReviewStore(pool);
}
