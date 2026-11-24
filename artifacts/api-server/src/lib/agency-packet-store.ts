import pg from "pg";
import { createHash } from "node:crypto";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { PacketError } from "./packet-errors.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { registerPacketSubmission } from "./packet-review-store.js";
import { packetSubmissionReady } from "@workspace/api-zod/packet-readiness";

export { PacketError } from "./packet-errors.js";

export type PacketReport = {
  id: string; date: string; phase: number; className: string;
  recruitBadge: string; ftoBadge: string;
  [key: string]: unknown;
};
export type PacketChange = { operation_id: string; base_version: number; report: PacketReport;
  amendment_of?: string; amendment_reason?: string };
export type PacketReviewAction = "release" | "withdraw" | "acknowledge";
export type PacketReviewChange = { operation_id: string; content_hash: string;
  review_confirmed?: boolean; reason?: string; comments?: string };
export type PacketReceipt = {
  id: string; operation_id: string; server_version: number;
  sync_status: "local_draft_pending" | "synchronized_complete";
};
export type PacketAuditContext = { requestId: string; clientIp: string };
type Assignment = { id: string; fto_name: string; fto_badge_hash: string;
  po_name: string; po_badge_hash: string; class_name: string; phase: number };

// All identifiers are constants; all external values are parameterized.
const authorizedScope = `(a.active AND pa.active AND (
  ($1 = 'FTO' AND a.fto_id_hash = $2 AND a.fto_badge_hash = $3) OR
  ($1 = 'PO' AND a.po_id_hash = $2 AND a.po_badge_hash = $3
    AND p.released_to_po = true AND p.withdrawn_at IS NULL) OR
  ($1 = 'FTO_COORDINATOR' AND (
    EXISTS(SELECT 1 FROM agency_training.po_coordinators pc WHERE pc.po_id_hash=a.po_id_hash AND pc.coordinator_id=$5)
    OR (NOT EXISTS(SELECT 1 FROM agency_training.po_coordinators pc WHERE pc.po_id_hash=a.po_id_hash)
      AND a.coordinator_id_hash = $2)))))`;
const packetColumns = `p.id, p.assignment_id, p.record_date::text, p.phase,
  p.server_version, p.report, p.submission_status, p.content_hash, p.released_to_po,
  p.released_at, p.withdrawn_at, p.withdrawal_reason, p.amendment_of, p.amendment_reason,
  (SELECT jsonb_build_object('acknowledged_at', k.acknowledged_at,
    'content_hash', k.content_hash, 'comments', k.comments)
   FROM agency_training.packet_acknowledgments k WHERE k.packet_id = p.id) AS acknowledgment`;
const identityHash = (identity: AgencyIdentity) => hashUserIdentifier(identity.id);
const badgeHash = (identity: AgencyIdentity) => hashUserIdentifier(identity.badge);
const digestJson = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const PACKET_PAGE_SIZE = 100;

type PacketCursor = { recordDate: string; id: string };
type PacketPage = { data: Record<string, unknown>[]; hasMore: boolean };
export type PacketHistoryFilters = { recruit?: string; dateFrom?: string; dateTo?: string };

function packetFilterHash(filters: PacketHistoryFilters): string {
  return createHash("sha256").update(JSON.stringify({
    recruit: filters.recruit ?? null,
    dateFrom: filters.dateFrom ?? null,
    dateTo: filters.dateTo ?? null,
  })).digest("hex").slice(0, 16);
}

export function encodePacketCursor(recordDate: string, id: string, filters: PacketHistoryFilters = {}): string {
  const hasFilters = Boolean(filters.recruit || filters.dateFrom || filters.dateTo);
  return Buffer.from(JSON.stringify({
    recordDate, id, ...(hasFilters ? { filterHash: packetFilterHash(filters) } : {}),
  })).toString("base64url");
}

function decodePacketCursor(cursor: string | undefined, filters: PacketHistoryFilters): PacketCursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (Buffer.from(decoded).toString("base64url") !== cursor) throw new Error();
    const value: unknown = JSON.parse(decoded);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const record = value as Record<string, unknown>;
    const hasFilters = Boolean(filters.recruit || filters.dateFrom || filters.dateTo);
    if ((hasFilters
        ? Object.keys(record).length !== 3 || record.filterHash !== packetFilterHash(filters)
        : Object.keys(record).length !== 2) ||
      typeof record.recordDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.recordDate) ||
      typeof record.id !== "string" || !record.id || record.id.length > 128) throw new Error();
    return { recordDate: record.recordDate, id: record.id };
  } catch {
    throw new PacketError(400, "INVALID_PACKET_CURSOR");
  }
}

export function createAgencyPacketStore(pool: pg.Pool) {
  return {
    async readPage(identity: AgencyIdentity, audit: PacketAuditContext, cursor?: string,
      filters: PacketHistoryFilters = {}): Promise<PacketPage> {
      const after = decodePacketCursor(cursor, filters);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `SELECT ${packetColumns}
           FROM agency_training.packets p JOIN agency_training.packet_assignments pa
             ON pa.packet_id = p.id AND pa.assignment_id = p.assignment_id
           JOIN agency_training.assignments a ON a.id = p.assignment_id
           WHERE ${authorizedScope}
             AND ($4::text IS NULL OR
               position(lower($4::text) in lower(coalesce(p.report->>'recruitName', ''))) > 0 OR
               position(lower($4::text) in lower(coalesce(p.report->>'recruitBadge', ''))) > 0)
             AND ($6::date IS NULL OR p.record_date >= $6::date)
             AND ($7::date IS NULL OR p.record_date <= $7::date)
             AND ($8::date IS NULL OR (p.record_date, p.id) < ($8::date, $9::text))
             AND (p.submission_status = 'submitted' OR $1 = 'FTO')
           ORDER BY p.record_date DESC, p.id DESC LIMIT $10`,
          [identity.role, identityHash(identity), badgeHash(identity), filters.recruit ?? null, identity.id,
            filters.dateFrom ?? null, filters.dateTo ?? null, after?.recordDate ?? null,
            after?.id ?? null, PACKET_PAGE_SIZE + 1],
        );
        const hasMore = result.rows.length > PACKET_PAGE_SIZE;
        const rows = result.rows.slice(0, PACKET_PAGE_SIZE);
        await client.query(
          `INSERT INTO agency_training.packet_events
           (request_id, actor_hash, actor_role, client_ip_hash, event_type, record_count)
           VALUES ($1,$2,$3,$4,'READ',$5)`,
          [audit.requestId, identityHash(identity), identity.role,
            hashUserIdentifier(audit.clientIp), rows.length],
        );
        await client.query("COMMIT");
        return {
          data: rows.map(({ submission_status, ...row }) => ({ ...row,
            sync_status: submission_status === "submitted" ? "synchronized_complete" : "local_draft_pending" })),
          hasMore,
        };
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async read(identity: AgencyIdentity, audit: PacketAuditContext, id?: string) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `SELECT ${packetColumns}
           FROM agency_training.packets p JOIN agency_training.packet_assignments pa
             ON pa.packet_id = p.id AND pa.assignment_id = p.assignment_id
           JOIN agency_training.assignments a ON a.id = p.assignment_id
           WHERE ${authorizedScope} AND ($4::text IS NULL OR p.id = $4)
             AND (p.submission_status = 'submitted' OR $1 = 'FTO')
           ORDER BY p.record_date DESC, p.id LIMIT 100`,
          [identity.role, identityHash(identity), badgeHash(identity), id ?? null, identity.id],
        );
        // An empty result never discloses whether an unauthorized packet exists.
        if (id && result.rows.length === 0) throw new PacketError(404, "PACKET_NOT_FOUND");
        await client.query(
          `INSERT INTO agency_training.packet_events
           (request_id, actor_hash, actor_role, client_ip_hash, event_type, record_count)
           VALUES ($1,$2,$3,$4,'READ',$5)`,
          [audit.requestId, identityHash(identity), identity.role,
            hashUserIdentifier(audit.clientIp), result.rows.length],
        );
        await client.query("COMMIT");
        return result.rows.map(({ submission_status, ...row }) => ({ ...row,
          sync_status: submission_status === "submitted" ? "synchronized_complete" : "local_draft_pending" }));
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async review(identity: AgencyIdentity, audit: PacketAuditContext, id: string,
      action: PacketReviewAction, change: PacketReviewChange) {
      if (identity.role !== (action === "acknowledge" ? "PO" : "FTO_COORDINATOR"))
        throw new PacketError(403, "PACKET_REVIEW_FORBIDDEN");
      if (action !== "withdraw" && change.review_confirmed !== true)
        throw new PacketError(400, "PACKET_REVIEW_REQUIRED");
      if (action === "withdraw" && !change.reason?.trim())
        throw new PacketError(400, "PACKET_WITHDRAWAL_REASON_REQUIRED");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // The same lock is taken by upload and review, so a withdrawal and PO
        // acknowledgment cannot both pass their state checks concurrently.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [id]);
        const owner=await client.query<{po_id:string|null}>(`SELECT a.po_id FROM agency_training.packets p
          JOIN agency_training.assignments a ON a.id=p.assignment_id WHERE p.id=$1`,[id]);
        if(owner.rows[0]?.po_id) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`po:${owner.rows[0].po_id}`]);
        const scoped = await client.query(
          `SELECT ${packetColumns}
           FROM agency_training.packets p JOIN agency_training.packet_assignments pa
             ON pa.packet_id = p.id AND pa.assignment_id = p.assignment_id
           JOIN agency_training.assignments a ON a.id = p.assignment_id
           WHERE ${authorizedScope} AND p.id = $4`,
          [identity.role, identityHash(identity), badgeHash(identity), id, identity.id],
        );
        const packet = scoped.rows[0];
        if (!packet) throw new PacketError(404, "PACKET_NOT_FOUND");
        if(packet.submission_status!=="submitted") throw new PacketError(409,"PACKET_NOT_SUBMITTED");
        if (packet.content_hash !== change.content_hash) throw new PacketError(409, "PACKET_SNAPSHOT_CONFLICT");
        const requestHash = digestJson({ id, action, content_hash: change.content_hash,
          review_confirmed: change.review_confirmed, reason: change.reason, comments: change.comments });
        const prior = await client.query(
          "SELECT packet_id, actor_hash, event_type, request_hash FROM agency_training.packet_events WHERE operation_id=$1",
          [change.operation_id],
        );
        if (prior.rows.length) {
          const event = prior.rows[0];
          if (event.packet_id !== id || event.actor_hash !== identityHash(identity) ||
            event.event_type !== action.toUpperCase() || event.request_hash !== requestHash)
            throw new PacketError(409, "PACKET_OPERATION_CONFLICT");
          await client.query("COMMIT");
          return [{ ...packet, sync_status: "synchronized_complete" as const }];
        }
        if (packet.withdrawn_at) throw new PacketError(409, "PACKET_WITHDRAWN");
        if (action === "release") {
          if (packet.released_to_po) throw new PacketError(409, "PACKET_ALREADY_RELEASED");
          const approved=await client.query(`SELECT 1 FROM agency_training.packet_submissions
            WHERE packet_id=$1 AND packet_version=$2 AND state='approved'`,[id,packet.server_version]);
          if(!approved.rows.length) throw new PacketError(409,"PACKET_APPROVAL_REQUIRED");
          await client.query(
            `UPDATE agency_training.packets SET released_to_po=true, released_at=clock_timestamp(), released_by_hash=$2 WHERE id=$1`,
            [id, identityHash(identity)],
          );
        } else if (action === "withdraw") {
          // Unreleased snapshots can also need correction. Withdrawal closes
          // them permanently and allows one append-only replacement.
          await client.query(
            `UPDATE agency_training.packets SET released_to_po=false, withdrawn_at=clock_timestamp(),
             withdrawn_by_hash=$2, withdrawal_reason=$3 WHERE id=$1`,
            [id, identityHash(identity), change.reason],
          );
          const withdrawn=await client.query<{id:string}>(`UPDATE agency_training.packet_submissions
            SET state='withdrawn',reviewed_at=now(),review_note=$2 WHERE packet_id=$1 AND packet_version=$3 AND state<>'withdrawn' RETURNING id`,
            [id,change.reason,packet.server_version]);
          for(const row of withdrawn.rows) await client.query(`INSERT INTO agency_training.packet_review_events
            (submission_id,actor_hash,action,note) VALUES ($1,$2,'WITHDRAWN',$3)`,
            [row.id,identityHash(identity),change.reason]);
        } else {
          if (!packet.released_to_po) throw new PacketError(409, "PACKET_NOT_RELEASED");
          if (packet.acknowledgment) throw new PacketError(409, "PACKET_ALREADY_ACKNOWLEDGED");
          await client.query(
            `INSERT INTO agency_training.packet_acknowledgments (packet_id, actor_hash, content_hash, comments)
             VALUES ($1,$2,$3,$4)`,
            [id, identityHash(identity), packet.content_hash, change.comments ?? ""],
          );
        }
        await client.query(
          `INSERT INTO agency_training.packet_events
           (request_id, packet_id, actor_hash, actor_role, client_ip_hash, event_type, record_count,
            operation_id, request_hash, content_hash)
           VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9)`,
          [audit.requestId, id, identityHash(identity), identity.role, hashUserIdentifier(audit.clientIp),
            action.toUpperCase(), change.operation_id, requestHash, packet.content_hash],
        );
        const result = await client.query(`SELECT ${packetColumns} FROM agency_training.packets p WHERE p.id=$1`, [id]);
        await client.query("COMMIT");
        return result.rows.map(row => ({ ...row, sync_status: "synchronized_complete" as const }));
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async sync(identity: AgencyIdentity, audit: PacketAuditContext, changes: PacketChange[]): Promise<PacketReceipt[]> {
      if (identity.role !== "FTO") throw new PacketError(403, "PACKET_SYNC_FORBIDDEN");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const receipts: PacketReceipt[] = [];
        // Stable lock order prevents opposite-order batches from deadlocking.
        for (const change of [...changes].sort((a, b) => a.report.id.localeCompare(b.report.id))) {
          const { report } = change;
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [report.id]);
          const assignmentResult = await client.query<Assignment>(
            `SELECT id, fto_name, fto_badge_hash, po_name, po_badge_hash, class_name, phase
             FROM agency_training.assignments
             WHERE active AND fto_id_hash=$1 AND fto_badge_hash=$2
               AND po_badge_hash=$3 AND class_name=$4 AND phase=$5
               AND $6::date BETWEEN starts_on AND ends_on`,
            [identityHash(identity), badgeHash(identity), hashUserIdentifier(report.recruitBadge),
              report.className, report.phase, report.date],
          );
          const assignment = assignmentResult.rows[0];
          if (assignmentResult.rows.length !== 1 || !assignment || hashUserIdentifier(report.ftoBadge) !== assignment.fto_badge_hash ||
            hashUserIdentifier(report.recruitBadge) !== assignment.po_badge_hash || report.phase !== assignment.phase ||
            report.className !== assignment.class_name) throw new PacketError(403, "PACKET_ASSIGNMENT_REQUIRED");
          const digest = digestJson(report);
          const existing = await client.query<{
            operation_id: string; content_hash: string; server_version: number; assignment_id: string; submission_status: string;
            amendment_of: string | null; amendment_reason: string | null; record_date:string; phase:number;
          }>("SELECT operation_id, content_hash, server_version, assignment_id, submission_status, amendment_of, amendment_reason, record_date::text, phase FROM agency_training.packets WHERE id=$1 FOR UPDATE", [report.id]);
          const prior = existing.rows[0];
          if(prior && (prior.assignment_id !== assignment.id || prior.record_date!==report.date || prior.phase!==report.phase ||
              (prior.amendment_of ?? undefined) !== change.amendment_of ||
              (prior.amendment_reason ?? undefined) !== change.amendment_reason))
            throw new PacketError(409,"PACKET_ASSIGNMENT_CONFLICT");
          if (prior?.operation_id === change.operation_id) {
            if(prior.content_hash !== digest) throw new PacketError(409,"PACKET_OPERATION_CONFLICT");
            receipts.push({ id: report.id, operation_id: change.operation_id,
              server_version: prior.server_version, sync_status: prior.submission_status === "submitted"
                ? "synchronized_complete" : "local_draft_pending" });
            continue;
          }
          if(prior?.submission_status === "submitted") throw new PacketError(409,"PACKET_ALREADY_SUBMITTED");
          if(change.base_version !== (prior?.server_version ?? 0)) throw new PacketError(409,"PACKET_VERSION_CONFLICT");
          const version=(prior?.server_version ?? 0)+1;
          if (Boolean(change.amendment_of) !== Boolean(change.amendment_reason?.trim()))
            throw new PacketError(400, "PACKET_AMENDMENT_REASON_REQUIRED");
          if (!prior && change.amendment_of) {
            // Original content and acknowledgment remain immutable. A withdrawn
            // packet accepts one replacement; every replacement starts unreleased.
            const parent = await client.query(
              `SELECT id FROM agency_training.packets WHERE id=$1 AND assignment_id=$2
               AND record_date=$3::date AND phase=$4 AND withdrawn_at IS NOT NULL`,
              [change.amendment_of, assignment.id, report.date, report.phase],
            );
            if (!parent.rows.length || change.amendment_of === report.id)
              throw new PacketError(409, "PACKET_AMENDMENT_REQUIRES_WITHDRAWAL");
            const child = await client.query("SELECT id FROM agency_training.packets WHERE amendment_of=$1", [change.amendment_of]);
            if (child.rows.length) throw new PacketError(409, "PACKET_AMENDMENT_EXISTS");
          }
          const savedReport = { ...report };
          if(!prior) await client.query(
            `INSERT INTO agency_training.packet_assignments (packet_id, assignment_id, record_date)
             VALUES ($1,$2,$3)`,
            [report.id, assignment.id, report.date],
          );
          if(prior) await client.query(
            `UPDATE agency_training.packets SET operation_id=$2, content_hash=$3, report=$4::jsonb,
             server_version=$5 WHERE id=$1 AND submission_status='local_draft_pending'`,
            [report.id,change.operation_id,digest,JSON.stringify(savedReport),version],
          );
          else await client.query(
            `INSERT INTO agency_training.packets
              (id, assignment_id, record_date, phase, operation_id, content_hash, report, amendment_of, amendment_reason, submission_status)
              VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'local_draft_pending')`,
            [report.id, assignment.id, report.date, report.phase, change.operation_id, digest,
              JSON.stringify(savedReport), change.amendment_of ?? null, change.amendment_reason ?? null],
          );
          await client.query(
            `INSERT INTO agency_training.packet_events
             (request_id, packet_id, actor_hash, actor_role, client_ip_hash, event_type, record_count, content_hash)
             VALUES ($1,$2,$3,$4,$5,'DRAFT_SYNC',1,$6)`,
            [audit.requestId, report.id, identityHash(identity), identity.role,
              hashUserIdentifier(audit.clientIp), digest],
          );
          receipts.push({ id: report.id, operation_id: change.operation_id,
            server_version: version, sync_status: "local_draft_pending" });
        }
        await client.query("COMMIT");
        return receipts;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async finalize(identity: AgencyIdentity, id: string, operationId: string, baseVersion: number,audit:PacketAuditContext): Promise<PacketReceipt> {
      if(identity.role !== "FTO") throw new PacketError(403,"PACKET_SUBMIT_FORBIDDEN");
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",[id]);
        const assignmentLock=await client.query(
          "SELECT id FROM agency_training.lock_packet_assignment($1,$2,$3)",[id,identity.id,identity.badge]);
        if(!assignmentLock.rows.length) throw new PacketError(422,"PACKET_ASSIGNMENT_REQUIRED");
        // Neither a browser role, supplied badge, nor a supplied Coordinator ID
        // is authority. Recheck the assignment at finalization under row locks.
        const result=await client.query<{
          server_version:number; submission_status:string; finalization_operation_id:string|null; report:PacketReport;
           po_id:string;po_badge:string;po_id_hash:string;po_badge_hash:string;
         }>(`SELECT p.server_version,p.submission_status,p.finalization_operation_id,p.report,a.po_id,a.po_badge,a.po_id_hash,a.po_badge_hash
           FROM agency_training.packets p JOIN agency_training.packet_assignments pa
             ON pa.packet_id=p.id AND pa.assignment_id=p.assignment_id AND pa.active
           JOIN agency_training.assignments a ON a.id=p.assignment_id
          WHERE p.id=$1 AND a.active AND a.fto_id=$2 AND a.fto_badge=$3
             AND p.withdrawn_at IS NULL
             AND a.fto_id_hash=$4 AND a.fto_badge_hash=$5
             AND pa.record_date=p.record_date AND p.record_date BETWEEN a.starts_on AND a.ends_on
             AND a.class_name=p.report->>'className' AND a.phase=p.phase
             AND a.po_badge=p.report->>'recruitBadge' AND a.fto_badge=p.report->>'ftoBadge'
             AND a.po_id IS NOT NULL AND a.po_badge IS NOT NULL
           FOR UPDATE OF p`,[id,identity.id,identity.badge,identityHash(identity),badgeHash(identity)]);
        const packet=result.rows[0];
        if(!packet) throw new PacketError(403,"PACKET_ASSIGNMENT_REQUIRED");
         if(hashUserIdentifier(packet.po_id)!==packet.po_id_hash || hashUserIdentifier(packet.po_badge)!==packet.po_badge_hash)
           throw new PacketError(403,"PACKET_ASSIGNMENT_REQUIRED");
        if(packet.submission_status==="submitted") {
          if(packet.finalization_operation_id!==operationId) throw new PacketError(409,"PACKET_ALREADY_SUBMITTED");
        } else {
          if(packet.server_version!==baseVersion) throw new PacketError(409,"PACKET_VERSION_CONFLICT");
          if(!packetSubmissionReady(packet.report)) throw new PacketError(422,"PACKET_NOT_READY_FOR_SUBMISSION");
          await registerPacketSubmission(client,identity,{id,version:packet.server_version,
            poId:packet.po_id,poBadge:packet.po_badge,report:packet.report});
          await client.query(`UPDATE agency_training.packets SET submission_status='submitted',
            finalization_operation_id=$2,submitted_at=now() WHERE id=$1`,[id,operationId]);
          await client.query(`INSERT INTO agency_training.packet_events
            (packet_id,actor_hash,actor_role,request_id,client_ip_hash,event_type,record_count)
            VALUES ($1,$2,$3,$4,$5,'SUBMIT',1)`,
            [id,hashUserIdentifier(identity.id),identity.role,audit.requestId,hashUserIdentifier(audit.clientIp)]);
        }
        await client.query("COMMIT");
        return {id,operation_id:operationId,server_version:packet.server_version,sync_status:"synchronized_complete"};
      } catch(error) { await client.query("ROLLBACK"); throw error; }
      finally {client.release();}
    },
  };
}
export type AgencyPacketStore = ReturnType<typeof createAgencyPacketStore>;
let store: AgencyPacketStore | undefined;
export function getAgencyPacketStore(): AgencyPacketStore | null {
  const pool=getAgencyDatabasePool();
  if(!pool) return null;
  store ??= createAgencyPacketStore(pool);
  return store;
}
