import pg from "pg";
import { createHash } from "node:crypto";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { logger } from "./logger.js";

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
export class PacketError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export type PacketReceipt = {
  id: string; operation_id: string; server_version: number;
  sync_status: "synchronized_complete";
};
export type PacketAuditContext = { requestId: string; clientIp: string };
type Assignment = { id: string; fto_name: string; fto_badge_hash: string;
  po_name: string; po_badge_hash: string; class_name: string; phase: number };

// All identifiers are constants; all external values are parameterized.
const authorizedScope = `(a.active AND pa.active AND (
  ($1 = 'FTO' AND a.fto_id_hash = $2 AND a.fto_badge_hash = $3) OR
  ($1 = 'PO' AND a.po_id_hash = $2 AND a.po_badge_hash = $3
    AND p.released_to_po = true AND p.withdrawn_at IS NULL) OR
  ($1 = 'FTO_COORDINATOR' AND EXISTS (
    SELECT 1 FROM agency_training.assignments ca WHERE ca.active
      AND ca.class_name = a.class_name AND ca.coordinator_id_hash = $2))))`;
const packetColumns = `p.id, p.assignment_id, p.record_date::text, p.phase,
  p.server_version, p.report, p.content_hash, p.released_to_po,
  p.released_at, p.withdrawn_at, p.withdrawal_reason, p.amendment_of, p.amendment_reason,
  (SELECT jsonb_build_object('acknowledged_at', k.acknowledged_at,
    'content_hash', k.content_hash, 'comments', k.comments)
   FROM agency_training.packet_acknowledgments k WHERE k.packet_id = p.id) AS acknowledgment`;
const identityHash = (identity: AgencyIdentity) => hashUserIdentifier(identity.id);
const badgeHash = (identity: AgencyIdentity) => hashUserIdentifier(identity.badge);
const digestJson = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createAgencyPacketStore(pool: pg.Pool) {
  return {
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
           ORDER BY p.record_date DESC, p.id LIMIT 100`,
          [identity.role, identityHash(identity), badgeHash(identity), id ?? null],
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
        return result.rows.map(row => ({ ...row, sync_status: "synchronized_complete" as const }));
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
        const scoped = await client.query(
          `SELECT ${packetColumns}
           FROM agency_training.packets p JOIN agency_training.packet_assignments pa
             ON pa.packet_id = p.id AND pa.assignment_id = p.assignment_id
           JOIN agency_training.assignments a ON a.id = p.assignment_id
           WHERE ${authorizedScope} AND p.id = $4`,
          [identity.role, identityHash(identity), badgeHash(identity), id],
        );
        const packet = scoped.rows[0];
        if (!packet) throw new PacketError(404, "PACKET_NOT_FOUND");
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
            operation_id: string; content_hash: string; server_version: number; assignment_id: string;
            amendment_of: string | null; amendment_reason: string | null;
          }>("SELECT operation_id, content_hash, server_version, assignment_id, amendment_of, amendment_reason FROM agency_training.packets WHERE id=$1", [report.id]);
          const prior = existing.rows[0];
          if (prior) {
            // Uploaded packets are sealed: only exact retry is accepted.
            if (prior.assignment_id !== assignment.id || prior.operation_id !== change.operation_id || prior.content_hash !== digest ||
              (prior.amendment_of ?? undefined) !== change.amendment_of ||
              (prior.amendment_reason ?? undefined) !== change.amendment_reason)
              throw new PacketError(409, "PACKET_ALREADY_SYNCHRONIZED");
            receipts.push({ id: report.id, operation_id: change.operation_id,
              server_version: prior.server_version, sync_status: "synchronized_complete" });
            continue;
          }
          if (change.base_version !== 0) throw new PacketError(409, "PACKET_VERSION_CONFLICT");
          if (Boolean(change.amendment_of) !== Boolean(change.amendment_reason?.trim()))
            throw new PacketError(400, "PACKET_AMENDMENT_REASON_REQUIRED");
          if (change.amendment_of) {
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
          // Uploading seals a snapshot; it does NOT create a signature, verify
          // caller-supplied signature fields or authorize release to the PO.
          const savedReport = { ...report };
          await client.query(
            `INSERT INTO agency_training.packet_assignments (packet_id, assignment_id, record_date)
             VALUES ($1,$2,$3)`,
            [report.id, assignment.id, report.date],
          );
          await client.query(
            `INSERT INTO agency_training.packets
             (id, assignment_id, record_date, phase, operation_id, content_hash, report, amendment_of, amendment_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
            [report.id, assignment.id, report.date, report.phase, change.operation_id, digest,
              JSON.stringify(savedReport), change.amendment_of ?? null, change.amendment_reason ?? null],
          );
          await client.query(
            `INSERT INTO agency_training.packet_events
             (request_id, packet_id, actor_hash, actor_role, client_ip_hash, event_type, record_count, content_hash)
             VALUES ($1,$2,$3,$4,$5,'COMMIT',1,$6)`,
            [audit.requestId, report.id, identityHash(identity), identity.role,
              hashUserIdentifier(audit.clientIp), digest],
          );
          receipts.push({ id: report.id, operation_id: change.operation_id,
            server_version: 1, sync_status: "synchronized_complete" });
        }
        await client.query("COMMIT");
        return receipts;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
export type AgencyPacketStore = ReturnType<typeof createAgencyPacketStore>;
let pool: pg.Pool | undefined;
let store: AgencyPacketStore | undefined;
export function getAgencyPacketStore(): AgencyPacketStore | null {
  if (process.env.AGENCY_PACKET_SYNC_ENABLED !== "true") return null;
  const connectionString = process.env.AGENCY_DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000, statement_timeout: 10000 });
    // Do not log pg errors: error messages can contain SQL, paths or record data.
  pool.on("error", () => { logger.warn({ event: "agency_database_pool_error" }, "Agency records connection unavailable"); });
  }
  store ??= createAgencyPacketStore(pool);
  return store;
}
