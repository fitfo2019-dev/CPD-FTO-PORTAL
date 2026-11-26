import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  GetTestAdminScenarioResponse, ListTestAdminAuditEventsResponse,
  type TestAdminParticipantInput, type TestAdminClassInput, type TestAdminAssignmentInput,
  type TestAdminScenarioEnvelope, type TestAdminAuditEnvelope,
  ListTestAdminTrainingRecordVersionsResponse, type TestAdminRecordVersionsEnvelope,
} from "@workspace/api-zod";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { StagingFailure, StagingRepository, type Member, type StagingContext } from "./repository.js";

type TargetType = "PARTICIPANT" | "CLASS" | "ASSIGNMENT";

/**
 * Scenario setup for the synthetic test administrator. Every method requires
 * the TEST_ADMIN directory role (resolved server-side in the shared
 * transaction) and touches only rows flagged `fictional`. Fictional people get
 * a random subject hash, so no sign-in can ever resolve to them. Removal is an
 * audited deactivation; there is no delete path.
 */
export class TestAdminRepository extends StagingRepository {
  private async admin<T>(ctx: StagingContext, work: (tx: PoolClient, member: Member) => Promise<T>): Promise<T> {
    return this.transaction(ctx, async (tx, member) => {
      if (member.role !== "TEST_ADMIN") throw new StagingFailure(403, "TEST_ADMIN_REQUIRED");
      return work(tx, member);
    });
  }

  private async auditTarget(tx: PoolClient, ctx: StagingContext, member: Member, action: string, type: TargetType, id: string): Promise<void> {
    await tx.query(
      `INSERT INTO synthetic_training.audit_events
       (id,actor_hash,role,client_ip_hash,request_id,action,target_type,target_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), hashUserIdentifier(ctx.session.subject), member.role,
        hashUserIdentifier(ctx.clientIp || "UNKNOWN"), ctx.requestId, action, type, id],
    );
  }

  private async snapshot(tx: PoolClient): Promise<TestAdminScenarioEnvelope> {
    const participants = await tx.query(`SELECT id, display_label, badge_label, role, active FROM synthetic_training.members
      WHERE fictional ORDER BY active DESC, role, display_label LIMIT 500`);
    const classes = await tx.query(`SELECT id, label, coordinator_id, active FROM synthetic_training.classes
      WHERE fictional ORDER BY active DESC, label LIMIT 500`);
    const assignments = await tx.query(`SELECT id, class_id, po_id, fto_id, phase, to_char(starts_on,'YYYY-MM-DD') AS starts_on,
      to_char(ends_on,'YYYY-MM-DD') AS ends_on, active FROM synthetic_training.assignments
      WHERE fictional ORDER BY active DESC, starts_on DESC LIMIT 500`);
    return GetTestAdminScenarioResponse.parse({
      status: "success", metadata: { environment: "SYNTHETIC_STAGING" },
      data: { participants: participants.rows, classes: classes.rows, assignments: assignments.rows },
    });
  }

  /** Locks and verifies an active fictional participant with the expected role. */
  private async requireParticipant(tx: PoolClient, id: string, role: Member["role"]): Promise<void> {
    const found = await tx.query(
      `SELECT 1 FROM synthetic_training.members WHERE id=$1 AND fictional AND active AND role=$2 FOR SHARE`, [id, role],
    );
    if (!found.rows[0]) throw new StagingFailure(422, "PARTICIPANT_NOT_AVAILABLE");
  }

  private async requireClass(tx: PoolClient, id: string): Promise<void> {
    const found = await tx.query(
      "SELECT 1 FROM synthetic_training.classes WHERE id=$1 AND fictional AND active FOR SHARE", [id],
    );
    if (!found.rows[0]) throw new StagingFailure(422, "CLASS_NOT_AVAILABLE");
  }

  private async lockTarget(tx: PoolClient, table: "members" | "classes" | "assignments", id: string): Promise<{ active: boolean }> {
    const found = await tx.query<{ active: boolean }>(
      `SELECT active FROM synthetic_training.${table} WHERE id=$1 AND fictional FOR UPDATE`, [id],
    );
    if (!found.rows[0]) throw new StagingFailure(404, "SCENARIO_ITEM_NOT_FOUND");
    return found.rows[0];
  }

  async scenario(ctx: StagingContext): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async tx => this.snapshot(tx));
  }

  async auditHistory(ctx: StagingContext): Promise<TestAdminAuditEnvelope> {
    return this.admin(ctx, async tx => {
      // Actor and client hashes are deliberately not returned.
      const result = await tx.query(
        `SELECT id, to_char(timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp,
         role, action, target_type, target_id, record_id, version
         FROM synthetic_training.audit_events ORDER BY timestamp DESC, id LIMIT 200`,
      );
      return ListTestAdminAuditEventsResponse.parse({
        status: "success", metadata: { environment: "SYNTHETIC_STAGING" }, data: result.rows,
      });
    });
  }

  async recordVersions(ctx: StagingContext, id: string): Promise<TestAdminRecordVersionsEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      const record = await tx.query<{ version: number }>(
        `SELECT r.version FROM synthetic_training.records r
         JOIN synthetic_training.assignments a ON a.id=r.assignment_id
         JOIN synthetic_training.classes c ON c.id=a.class_id
         JOIN synthetic_training.members po ON po.id=a.po_id
         JOIN synthetic_training.members fto ON fto.id=a.fto_id
         JOIN synthetic_training.members coordinator ON coordinator.id=c.coordinator_id
         WHERE r.id=$1 AND a.fictional AND c.fictional
           AND po.fictional AND fto.fictional AND coordinator.fictional
         FOR SHARE OF r,a,c,po,fto,coordinator`,
        [id],
      );
      if (!record.rows[0]) throw new StagingFailure(404, "RECORD_NOT_FOUND");
      if (!ctx.requestId) throw new StagingFailure(503, "AUDIT_CONTEXT_REQUIRED");

      const versions = await tx.query<{ version: number; narrative: string; status: "draft" | "submitted" }>(
        `SELECT version,narrative,status FROM synthetic_training.record_versions
         WHERE record_id=$1 ORDER BY version ASC`,
        [id],
      );
      await tx.query(
        `INSERT INTO synthetic_training.audit_events
         (id,actor_hash,role,client_ip_hash,request_id,action,record_id,version)
         VALUES ($1,$2,$3,$4,$5,'READ_VERSIONS',$6,$7)`,
        [randomUUID(), hashUserIdentifier(ctx.session.subject), member.role,
          hashUserIdentifier(ctx.clientIp || "UNKNOWN"), ctx.requestId, id, record.rows[0].version],
      );
      return ListTestAdminTrainingRecordVersionsResponse.parse({
        status: "success",
        metadata: { environment: "SYNTHETIC_STAGING" },
        data: versions.rows,
      });
    });
  }

  async createParticipant(ctx: StagingContext, input: TestAdminParticipantInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      const id = randomUUID();
      // Random, unlinkable subject hash: no Clerk account can resolve to this row.
      await tx.query(
        `INSERT INTO synthetic_training.members
         (id,subject_hash,role,active,agency_verified,terms_accepted,fictional,display_label,badge_label)
         VALUES ($1,$2,$3,true,false,true,true,$4,$5)`,
        [id, randomBytes(32).toString("hex"), input.role, input.display_label, input.badge_label],
      );
      await this.auditTarget(tx, ctx, member, "CREATE_PARTICIPANT", "PARTICIPANT", id);
      return this.snapshot(tx);
    });
  }

  async updateParticipant(ctx: StagingContext, id: string, input: TestAdminParticipantInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      const current = await tx.query<{ role: string }>(
        "SELECT role FROM synthetic_training.members WHERE id=$1 AND fictional FOR UPDATE", [id],
      );
      if (!current.rows[0]) throw new StagingFailure(404, "SCENARIO_ITEM_NOT_FOUND");
      // A role change would silently invalidate existing assignments.
      if (current.rows[0].role !== input.role) throw new StagingFailure(409, "ROLE_CHANGE_NOT_ALLOWED");
      await tx.query(
        "UPDATE synthetic_training.members SET display_label=$2, badge_label=$3 WHERE id=$1",
        [id, input.display_label, input.badge_label],
      );
      await this.auditTarget(tx, ctx, member, "UPDATE_PARTICIPANT", "PARTICIPANT", id);
      return this.snapshot(tx);
    });
  }

  async createClass(ctx: StagingContext, input: TestAdminClassInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      await this.requireParticipant(tx, input.coordinator_id, "FTO_COORDINATOR");
      const id = randomUUID();
      await tx.query(
        `INSERT INTO synthetic_training.classes(id,coordinator_id,active,phase_active,fictional,label)
         VALUES ($1,$2,true,true,true,$3)`, [id, input.coordinator_id, input.label],
      );
      await this.auditTarget(tx, ctx, member, "CREATE_CLASS", "CLASS", id);
      return this.snapshot(tx);
    });
  }

  async updateClass(ctx: StagingContext, id: string, input: TestAdminClassInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      await this.lockTarget(tx, "classes", id);
      await this.requireParticipant(tx, input.coordinator_id, "FTO_COORDINATOR");
      await tx.query(
        "UPDATE synthetic_training.classes SET label=$2, coordinator_id=$3 WHERE id=$1",
        [id, input.label, input.coordinator_id],
      );
      await this.auditTarget(tx, ctx, member, "UPDATE_CLASS", "CLASS", id);
      return this.snapshot(tx);
    });
  }

  private async validateAssignment(tx: PoolClient, input: TestAdminAssignmentInput): Promise<void> {
    if (!validCalendarDate(input.starts_on) || !validCalendarDate(input.ends_on) || input.ends_on < input.starts_on) {
      throw new StagingFailure(422, "INVALID_ASSIGNMENT_DATES");
    }
    await this.requireClass(tx, input.class_id);
    await this.requireParticipant(tx, input.po_id, "PO");
    await this.requireParticipant(tx, input.fto_id, "FTO");
  }

  async createAssignment(ctx: StagingContext, input: TestAdminAssignmentInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      await this.validateAssignment(tx, input);
      const id = randomUUID();
      await tx.query(
        `INSERT INTO synthetic_training.assignments
         (id,class_id,po_id,fto_id,phase,starts_on,ends_on,active,fictional)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,true)`,
        [id, input.class_id, input.po_id, input.fto_id, input.phase, input.starts_on, input.ends_on],
      );
      await this.auditTarget(tx, ctx, member, "CREATE_ASSIGNMENT", "ASSIGNMENT", id);
      return this.snapshot(tx);
    });
  }

  async updateAssignment(ctx: StagingContext, id: string, input: TestAdminAssignmentInput): Promise<TestAdminScenarioEnvelope> {
    return this.admin(ctx, async (tx, member) => {
      await this.lockTarget(tx, "assignments", id);
      await this.validateAssignment(tx, input);
      const existing = await tx.query<{ class_id: string; po_id: string; fto_id: string; phase: number }>(
        "SELECT class_id, po_id, fto_id, phase FROM synthetic_training.assignments WHERE id=$1 FOR UPDATE", [id],
      );
      const recordCount = await tx.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM synthetic_training.records WHERE assignment_id=$1", [id],
      );
      if (Number(recordCount.rows[0]?.count) > 0 && existing.rows[0] &&
          (existing.rows[0].class_id !== input.class_id || existing.rows[0].po_id !== input.po_id ||
           existing.rows[0].fto_id !== input.fto_id || existing.rows[0].phase !== input.phase)) {
        throw new StagingFailure(409, "ASSIGNMENT_HAS_RECORDS");
      }
      // Existing records must stay inside the assignment's date window.
      const outside = await tx.query(
        `SELECT 1 FROM synthetic_training.records WHERE assignment_id=$1
         AND (record_date < $2::date OR record_date > $3::date) LIMIT 1`, [id, input.starts_on, input.ends_on],
      );
      if (outside.rows[0]) throw new StagingFailure(409, "RECORDS_OUTSIDE_DATES");
      await tx.query(
        `UPDATE synthetic_training.assignments SET class_id=$2, po_id=$3, fto_id=$4, phase=$5,
         starts_on=$6, ends_on=$7 WHERE id=$1`,
        [id, input.class_id, input.po_id, input.fto_id, input.phase, input.starts_on, input.ends_on],
      );
      await this.auditTarget(tx, ctx, member, "UPDATE_ASSIGNMENT", "ASSIGNMENT", id);
      return this.snapshot(tx);
    });
  }

  async deactivate(ctx: StagingContext, type: TargetType, id: string): Promise<TestAdminScenarioEnvelope> {
    const table = type === "PARTICIPANT" ? "members" : type === "CLASS" ? "classes" : "assignments";
    return this.admin(ctx, async (tx, member) => {
      const current = await this.lockTarget(tx, table, id);
      if (!current.active) throw new StagingFailure(409, "ALREADY_DEACTIVATED");
      if (type === "CLASS") {
        const linked = await tx.query(
          "SELECT 1 FROM synthetic_training.assignments WHERE class_id=$1 AND active LIMIT 1", [id],
        );
        if (linked.rows[0]) throw new StagingFailure(409, "CLASS_HAS_ACTIVE_ASSIGNMENTS");
      } else if (type === "PARTICIPANT") {
        const linked = await tx.query(
          "SELECT 1 FROM synthetic_training.assignments WHERE active AND (po_id=$1 OR fto_id=$1 OR class_id IN (SELECT id FROM synthetic_training.classes WHERE coordinator_id=$1)) LIMIT 1",
          [id],
        );
        if (linked.rows[0]) throw new StagingFailure(409, "PARTICIPANT_HAS_ACTIVE_ASSIGNMENTS");
      }
      await tx.query(`UPDATE synthetic_training.${table} SET active=false WHERE id=$1`, [id]);
      await this.auditTarget(tx, ctx, member, `DEACTIVATE_${type}`, type, id);
      return this.snapshot(tx);
    });
  }
}

export function validCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
