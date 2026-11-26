import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  ListStagingTrainingRecordsResponse,
  type StagingTrainingInput, type StagingTrainingUpdate,
  type StagingAcknowledgementInput, type StagingTrainingRecord,
  type StagingTrainingEnvelope,
} from "@workspace/api-zod";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { testAdminAuthorityAvailable, type VerifiedStagingSession } from "./access.js";

export class StagingFailure extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}
type Member = { id: string; role: "PO" | "FTO" | "FTO_COORDINATOR" | "TEST_ADMIN" };
type Assignment = { id: string; phase: number };
export type SyntheticRecord = StagingTrainingRecord;
export type StagingEnvelope = StagingTrainingEnvelope;
type CreateInput = StagingTrainingInput;
type UpdateInput = StagingTrainingUpdate;
type AcknowledgementInput = StagingAcknowledgementInput;
export type StagingContext = {
  session: VerifiedStagingSession; requestId: string; clientIp: string;
  onPrincipal?: (id: string, role: Member["role"]) => void;
};

const envelope = (data: SyntheticRecord[]): StagingEnvelope => ListStagingTrainingRecordsResponse.parse({
  status: "success", metadata: { total_records: data.length, environment: "SYNTHETIC_STAGING" }, data,
});
const recordColumns = `r.id, r.assignment_id, to_char(r.record_date,'YYYY-MM-DD') AS record_date,
 a.phase, r.narrative, r.status, r.version, r.acknowledged_version, true AS synthetic`;
// Scope is enforced INSIDE SQL for lists and object lookups, not in the browser.
const scopeSql = `
 a.active AND c.active AND c.phase_active
 AND po.active AND po.agency_verified AND po.terms_accepted AND po.role='PO'
 AND fto.active AND fto.agency_verified AND fto.terms_accepted AND fto.role='FTO'
 AND coordinator.active AND coordinator.agency_verified AND coordinator.terms_accepted
 AND coordinator.role='FTO_COORDINATOR'
 AND (
   -- TEST_ADMIN spans the synthetic schema only; real agency data is never here.
   $1='TEST_ADMIN'
   OR ($1='FTO' AND a.fto_id=$2)
   OR ($1='PO' AND a.po_id=$2)
   OR ($1='FTO_COORDINATOR' AND c.coordinator_id=$2)
 )`;
const assignmentJoin = `
 JOIN synthetic_training.classes c ON c.id=a.class_id
 JOIN synthetic_training.members po ON po.id=a.po_id
 JOIN synthetic_training.members fto ON fto.id=a.fto_id
 JOIN synthetic_training.members coordinator ON coordinator.id=c.coordinator_id`;

/**
 * Isolated prototype: synthetic narrative records, not the portal workspace
 * schema. No upload/import transport, delete API or unrestricted SQL interface.
 */
export class StagingRepository {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(ctx: StagingContext, work: (tx: PoolClient, member: Member) => Promise<T>): Promise<T> {
    if (!ctx.session.recentMfa) throw new StagingFailure(401, "MFA_REQUIRED");
    const tx = await this.pool.connect();
    try {
      await tx.query("BEGIN");
      await tx.query("SET LOCAL statement_timeout = '5s'");
      const membership = await tx.query<Member>(
        `SELECT id,role FROM synthetic_training.members
         WHERE subject_hash=$1 AND active AND terms_accepted
         AND ((role<>'TEST_ADMIN' AND agency_verified) OR (role='TEST_ADMIN' AND NOT agency_verified))
         FOR SHARE`,
        [hashUserIdentifier(ctx.session.subject)],
      );
      const member = membership.rows[0];
      if (!member) throw new StagingFailure(403, "AGENCY_ACCESS_DENIED");
      if (member.role === "TEST_ADMIN" && !testAdminAuthorityAvailable(ctx.session)) {
        throw new StagingFailure(403, "AGENCY_ACCESS_DENIED");
      }
      ctx.onPrincipal?.(ctx.session.subject, member.role);
      const result = await work(tx, member);
      await tx.query("COMMIT");
      return result;
    } catch (error) {
      await tx.query("ROLLBACK");
      throw error;
    } finally {
      tx.release();
    }
  }

  private async audit(tx: PoolClient, ctx: StagingContext, member: Member, action: string, record?: SyntheticRecord): Promise<void> {
    if (!ctx.requestId) throw new StagingFailure(503, "AUDIT_CONTEXT_REQUIRED");
    await tx.query(
      `INSERT INTO synthetic_training.audit_events
       (id,actor_hash,role,client_ip_hash,request_id,action,record_id,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), hashUserIdentifier(ctx.session.subject), member.role,
        hashUserIdentifier(ctx.clientIp || "UNKNOWN"), ctx.requestId, action, record?.id ?? null, record?.version ?? null],
    );
  }

  private async retainVersion(tx: PoolClient, record: SyntheticRecord): Promise<void> {
    await tx.query(
      `INSERT INTO synthetic_training.record_versions(record_id,version,narrative,status)
       VALUES ($1,$2,$3,$4)`, [record.id, record.version, record.narrative, record.status],
    );
  }

  private async getScoped(tx: PoolClient, member: Member, id: string, write = false): Promise<SyntheticRecord> {
    const result = await tx.query<SyntheticRecord>(
      `SELECT ${recordColumns} FROM synthetic_training.records r
       JOIN synthetic_training.assignments a ON a.id=r.assignment_id ${assignmentJoin}
       WHERE ${scopeSql} AND r.id=$3 AND r.record_date BETWEEN a.starts_on AND a.ends_on
       AND ($1<>'PO' OR r.status='submitted')
       ${write ? "FOR UPDATE OF r" : "FOR SHARE OF r"} FOR SHARE OF a,c,po,fto,coordinator`,
      [member.role, member.id, id],
    );
    if (!result.rows[0]) throw new StagingFailure(404, "RECORD_NOT_FOUND");
    return result.rows[0];
  }

  private async once(
    tx: PoolClient, ctx: StagingContext, operationId: string, payload: unknown,
    perform: () => Promise<StagingEnvelope>,
  ): Promise<StagingEnvelope> {
    const actorHash = hashUserIdentifier(ctx.session.subject);
    // Serialize identical actor/operation keys, including concurrent retries.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${actorHash}:${operationId}`]);
    const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const prior = await tx.query<{ digest: string; response: StagingEnvelope }>(
      "SELECT digest,response FROM synthetic_training.receipts WHERE actor_hash=$1 AND operation_id=$2",
      [actorHash, operationId],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].digest !== digest) throw new StagingFailure(409, "OPERATION_CONFLICT");
      return prior.rows[0].response;
    }
    const response = await perform();
    await tx.query(
      "INSERT INTO synthetic_training.receipts(actor_hash,operation_id,digest,response) VALUES ($1,$2,$3,$4)",
      [actorHash, operationId, digest, JSON.stringify(response)],
    );
    return response;
  }

  async list(ctx: StagingContext): Promise<StagingEnvelope> {
    return this.transaction(ctx, async (tx, member) => {
      const result = await tx.query<SyntheticRecord>(
        `SELECT ${recordColumns} FROM synthetic_training.records r
         JOIN synthetic_training.assignments a ON a.id=r.assignment_id ${assignmentJoin}
         WHERE ${scopeSql} AND r.record_date BETWEEN a.starts_on AND a.ends_on
         AND ($1<>'PO' OR r.status='submitted') ORDER BY r.record_date,r.id LIMIT 100
         FOR SHARE OF r,a,c,po,fto,coordinator`, [member.role, member.id],
      );
      await this.audit(tx, ctx, member, "LIST");
      return envelope(result.rows);
    });
  }

  async get(ctx: StagingContext, id: string): Promise<StagingEnvelope> {
    return this.transaction(ctx, async (tx, member) => {
      const record = await this.getScoped(tx, member, id);
      await this.audit(tx, ctx, member, "READ", record);
      return envelope([record]);
    });
  }

  async create(ctx: StagingContext, input: CreateInput): Promise<StagingEnvelope> {
    return this.transaction(ctx, async (tx, member) => {
      if (member.role !== "FTO" && member.role !== "TEST_ADMIN") throw new StagingFailure(403, "RECORD_EDIT_DENIED");
      const scope = await tx.query<Assignment>(
        `SELECT a.id,a.phase FROM synthetic_training.assignments a ${assignmentJoin}
         WHERE ${scopeSql} AND a.id=$3 AND $4::date BETWEEN a.starts_on AND a.ends_on
         FOR SHARE OF a,c,po,fto,coordinator`,
        [member.role, member.id, input.assignment_id, input.record_date],
      );
      if (!scope.rows[0]) throw new StagingFailure(404, "ASSIGNMENT_NOT_FOUND");
      return this.once(tx, ctx, input.operation_id, ["CREATE", input], async () => {
        const id = randomUUID();
        await tx.query(
          `INSERT INTO synthetic_training.records(id,assignment_id,record_date,narrative,status)
           VALUES ($1,$2,$3,$4,$5)`, [id, input.assignment_id, input.record_date, input.narrative, input.status],
        );
        const record = await this.getScoped(tx, member, id, true);
        await this.retainVersion(tx, record);
        await this.audit(tx, ctx, member, "CREATE", record);
        return envelope([record]);
      });
    });
  }

  async update(ctx: StagingContext, id: string, input: UpdateInput): Promise<StagingEnvelope> {
    return this.transaction(ctx, async (tx, member) => {
      if (member.role !== "FTO" && member.role !== "TEST_ADMIN") throw new StagingFailure(403, "RECORD_EDIT_DENIED");
      const record = await this.getScoped(tx, member, id, true);
      return this.once(tx, ctx, input.operation_id, ["UPDATE", id, input], async () => {
        if (record.version !== input.base_version) throw new StagingFailure(409, "VERSION_CONFLICT");
        await tx.query(
          `UPDATE synthetic_training.records SET narrative=$2,status=$3,version=version+1,
           acknowledged_version=NULL WHERE id=$1`, [id, input.narrative, input.status],
        );
        const updated = await this.getScoped(tx, member, id, true);
        await this.retainVersion(tx, updated);
        await this.audit(tx, ctx, member, "UPDATE", updated);
        return envelope([updated]);
      });
    });
  }

  async acknowledge(ctx: StagingContext, id: string, input: AcknowledgementInput): Promise<StagingEnvelope> {
    return this.transaction(ctx, async (tx, member) => {
      // Acknowledgement is the PO's own attestation; no administrator may make it.
      if (member.role !== "PO") throw new StagingFailure(403, "ACKNOWLEDGEMENT_DENIED");
      const record = await this.getScoped(tx, member, id, true);
      return this.once(tx, ctx, input.operation_id, ["ACKNOWLEDGE", id, input], async () => {
        if (record.version !== input.base_version) throw new StagingFailure(409, "VERSION_CONFLICT");
        // This is a version-bound acknowledgement, NOT a certified electronic signature.
        await tx.query("UPDATE synthetic_training.records SET acknowledged_version=version WHERE id=$1", [id]);
        const updated = await this.getScoped(tx, member, id, true);
        await this.audit(tx, ctx, member, "ACKNOWLEDGE", updated);
        return envelope([updated]);
      });
    });
  }
}
