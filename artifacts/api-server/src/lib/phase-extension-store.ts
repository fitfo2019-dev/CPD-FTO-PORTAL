import type { PhaseExtensionRequestInput } from "@workspace/api-zod";
import type { Pool } from "pg";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

export type SharedPhaseExtensionRequest = PhaseExtensionRequestInput & {
  status: "pending" | "approved" | "denied";
  createdAt: string;
  reviewedAt: string | null;
  denialExplanation: string | null;
};

type RequestRow = {
  id: string;
  class_name: string;
  recruit_name: string;
  recruit_badge: string;
  phase: number;
  phase_start_date: string | Date;
  requesting_fto_name: string;
  requesting_fto_badge: string;
  extension_type: "training_weeks" | "limbo_period";
  requested_weeks: number;
  justification: string;
  status: "pending" | "approved" | "denied";
  created_at: Date;
  reviewed_at: Date | null;
  denial_explanation: string | null;
  requester_user_id: string;
  reviewed_by_user_id: string | null;
  assignment_id: string;
  created?: boolean;
};

export type PhaseExtensionRequestStore = {
  listForFto(userId: string): Promise<SharedPhaseExtensionRequest[]>;
  listPending(coordinatorUserId: string): Promise<SharedPhaseExtensionRequest[]>;
  create(userId: string, input: PhaseExtensionRequestInput): Promise<{
    request: SharedPhaseExtensionRequest;
    created: boolean;
  }>;
  review(
    id: string,
    reviewerUserId: string,
    decision: "approve" | "deny",
    denialExplanation?: string,
  ): Promise<{
    request: SharedPhaseExtensionRequest | null;
    alreadyResolved: boolean;
  }>;
};

function toRequest(row: RequestRow): SharedPhaseExtensionRequest {
  return {
    id: row.id,
    className: row.class_name,
    recruitName: row.recruit_name,
    recruitBadge: row.recruit_badge,
    phase: row.phase as 1 | 2 | 3 | 4,
    phaseStartDate: row.phase_start_date instanceof Date
      ? row.phase_start_date.toISOString().slice(0, 10)
      : row.phase_start_date.slice(0, 10),
    requestingFtoName: row.requesting_fto_name,
    requestingFtoBadge: row.requesting_fto_badge,
    extensionType: row.extension_type,
    requestedWeeks: row.requested_weeks,
    justification: row.justification,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    denialExplanation: row.denial_explanation,
  };
}

const columns = `r.id, r.class_name, r.recruit_name, r.recruit_badge, r.phase, r.phase_start_date,
  r.requesting_fto_name, r.requesting_fto_badge, r.extension_type, r.requested_weeks,
  r.justification, r.status, r.created_at, r.reviewed_at, r.requester_user_id,
  r.reviewed_by_user_id, r.assignment_id, r.denial_explanation`;

const assignmentColumns = `a.id, a.class_name, a.po_name, a.po_badge, a.phase,
  a.starts_on, a.fto_name, a.fto_badge`;

const activeFtoAssignment = `a.active
  AND a.fto_id = $1
  AND a.fto_id_hash = $2
  AND a.class_name = $3
  AND a.po_badge = $4
  AND a.po_badge_hash = $5
  AND a.phase = $6
  AND a.starts_on = $7::date
  AND a.po_id IS NOT NULL
  AND a.po_name IS NOT NULL
  AND a.fto_name IS NOT NULL
  AND a.fto_badge IS NOT NULL`;

const coordinatorAssignmentScope = (userIdParam: number, hashParam: number) => `(
  EXISTS (
    SELECT 1 FROM agency_training.coordinator_directory d
    WHERE d.id = $${userIdParam} AND d.active
  )
  AND EXISTS (
    SELECT 1
    FROM agency_training.assignments a
    LEFT JOIN agency_training.po_coordinators pc
      ON pc.po_id_hash = a.po_id_hash
    WHERE a.id = r.assignment_id
      AND a.active
      AND a.po_id IS NOT NULL
      AND (
        (pc.po_id IS NOT NULL AND pc.coordinator_id = $${userIdParam})
        OR (pc.po_id IS NULL AND a.coordinator_id_hash = $${hashParam})
      )
  )
)`;

export function createPhaseExtensionRequestStore(
  pool: Pick<Pool, "query" | "connect">,
): PhaseExtensionRequestStore {
  return {
    async listForFto(userId) {
      const result = await pool.query<RequestRow>(
        `SELECT ${columns} FROM agency_training.phase_extension_requests r
         WHERE r.requester_user_id = $1 ORDER BY r.created_at DESC`,
        [userId],
      );
      return result.rows.map(toRequest);
    },
    async listPending(coordinatorUserId) {
      const result = await pool.query<RequestRow>(
        `SELECT ${columns} FROM agency_training.phase_extension_requests r
         WHERE (r.status = 'pending'
           OR (r.status = 'denied' AND r.denial_explanation IS NOT NULL))
           AND ${coordinatorAssignmentScope(1, 2)}
         ORDER BY r.created_at ASC`,
        [coordinatorUserId, hashUserIdentifier(coordinatorUserId)],
      );
      return result.rows.map(toRequest);
    },
    async create(userId, input) {
      const userIdHash = hashUserIdentifier(userId);
      const recruitBadgeHash = hashUserIdentifier(input.recruitBadge);
      const justification = input.justification.trim();
      const saved = await pool.query<RequestRow>(
        `WITH assignment AS MATERIALIZED (
          SELECT ${assignmentColumns}
          FROM agency_training.assignments a
          WHERE ${activeFtoAssignment}
          ORDER BY a.id
          LIMIT 1
        ), inserted AS (
          INSERT INTO agency_training.phase_extension_requests (
            id, assignment_id, requester_user_id, class_name, recruit_name,
            recruit_badge, phase, phase_start_date, requesting_fto_name,
            requesting_fto_badge, extension_type, requested_weeks,
            justification, status, created_at
          )
          SELECT $8, assignment.id, $1, assignment.class_name, assignment.po_name,
            assignment.po_badge, assignment.phase, assignment.starts_on,
            assignment.fto_name, assignment.fto_badge, $9, $10, $11,
            'pending', NOW()
          FROM assignment
          ON CONFLICT (id) DO NOTHING
          RETURNING *
        ), retried AS (
          SELECT r.*
          FROM agency_training.phase_extension_requests r
          JOIN assignment ON assignment.id = r.assignment_id
          WHERE r.id = $8
            AND r.requester_user_id = $1
            AND r.extension_type = $9
            AND r.requested_weeks = $10
            AND r.justification = $11
        )
        SELECT inserted.*, TRUE AS created FROM inserted
        UNION ALL
        SELECT retried.*, FALSE AS created FROM retried`,
        [
          userId,
          userIdHash,
          input.className,
          input.recruitBadge,
          recruitBadgeHash,
          input.phase,
          input.phaseStartDate,
          input.id,
          input.extensionType,
          input.requestedWeeks,
          justification,
        ],
      );
      if (saved.rows[0]) {
        return { request: toRequest(saved.rows[0]), created: saved.rows[0].created === true };
      }

      const assignment = await pool.query(
        `SELECT 1 FROM agency_training.assignments a
         WHERE ${activeFtoAssignment}
         LIMIT 1`,
        [
          userId,
          userIdHash,
          input.className,
          input.recruitBadge,
          recruitBadgeHash,
          input.phase,
          input.phaseStartDate,
        ],
      );
      if (!assignment.rows.length) throw new Error("PHASE_EXTENSION_ASSIGNMENT_REQUIRED");
      throw new Error("PHASE_EXTENSION_ID_CONFLICT");
    },
    async review(id, reviewerUserId, decision, denialExplanation) {
      const status = decision === "approve" ? "approved" : "denied";
      const explanation = decision === "deny"
        ? denialExplanation?.trim() || null
        : null;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const assignment = await client.query<{ po_id: string | null }>(
          `SELECT a.po_id
           FROM agency_training.phase_extension_requests r
           JOIN agency_training.assignments a ON a.id = r.assignment_id
           WHERE r.id = $1`,
          [id],
        );
        if (assignment.rows[0]?.po_id) {
          // Coordinator handoffs take this same lock. Acquire it in a prior
          // statement so the ownership query gets a fresh READ COMMITTED
          // snapshot after a handoff that was already in progress commits.
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [`po:${assignment.rows[0].po_id}`],
          );
        }
        const result = await client.query<RequestRow>(
          `UPDATE agency_training.phase_extension_requests r
           SET status = $4, reviewed_at = NOW(), reviewed_by_user_id = $2,
               denial_explanation = $5
           WHERE r.id = $1 AND r.status = 'pending'
             AND ${coordinatorAssignmentScope(2, 3)}
           RETURNING ${columns}`,
          [id, reviewerUserId, hashUserIdentifier(reviewerUserId), status, explanation],
        );
        if (result.rows[0]) {
          await client.query("COMMIT");
          return { request: toRequest(result.rows[0]), alreadyResolved: false };
        }
        const existing = await client.query<RequestRow>(
          `SELECT ${columns}
           FROM agency_training.phase_extension_requests r
           WHERE r.id = $1 AND ${coordinatorAssignmentScope(2, 3)}`,
          [id, reviewerUserId, hashUserIdentifier(reviewerUserId)],
        );
        await client.query("COMMIT");
        return {
          request: existing.rows[0] ? toRequest(existing.rows[0]) : null,
          alreadyResolved: Boolean(existing.rows[0]),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
