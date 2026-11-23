import type { PhaseExtensionRequestInput } from "@workspace/api-zod";
import type { Pool } from "pg";

export type SharedPhaseExtensionRequest = PhaseExtensionRequestInput & {
  status: "pending" | "approved" | "denied";
  createdAt: string;
  reviewedAt: string | null;
};

type RequestRow = {
  id: string;
  class_name: string;
  recruit_name: string;
  recruit_badge: string;
  phase: number;
  phase_start_date: string;
  requesting_fto_name: string;
  requesting_fto_badge: string;
  extension_type: "training_weeks" | "limbo_period";
  requested_weeks: number;
  justification: string;
  status: "pending" | "approved" | "denied";
  created_at: Date;
  reviewed_at: Date | null;
  requester_user_id: string;
};

export type PhaseExtensionRequestStore = {
  listForFto(userId: string): Promise<SharedPhaseExtensionRequest[]>;
  listPending(): Promise<SharedPhaseExtensionRequest[]>;
  create(userId: string, input: PhaseExtensionRequestInput): Promise<{
    request: SharedPhaseExtensionRequest;
    created: boolean;
  }>;
  review(id: string, reviewerUserId: string, decision: "approve" | "deny"): Promise<{
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
    phaseStartDate: row.phase_start_date,
    requestingFtoName: row.requesting_fto_name,
    requestingFtoBadge: row.requesting_fto_badge,
    extensionType: row.extension_type,
    requestedWeeks: row.requested_weeks,
    justification: row.justification,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

const columns = `id, class_name, recruit_name, recruit_badge, phase, phase_start_date,
  requesting_fto_name, requesting_fto_badge, extension_type, requested_weeks,
  justification, status, created_at, reviewed_at, requester_user_id`;

export function createPhaseExtensionRequestStore(
  pool: Pick<Pool, "query">,
): PhaseExtensionRequestStore {
  return {
    async listForFto(userId) {
      const result = await pool.query<RequestRow>(
        `SELECT ${columns} FROM phase_extension_requests
         WHERE requester_user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );
      return result.rows.map(toRequest);
    },
    async listPending() {
      const result = await pool.query<RequestRow>(
        `SELECT ${columns} FROM phase_extension_requests
         WHERE status = 'pending' ORDER BY created_at ASC`,
      );
      return result.rows.map(toRequest);
    },
    async create(userId, input) {
      const inserted = await pool.query<RequestRow>(
        `INSERT INTO phase_extension_requests (
          id, requester_user_id, class_name, recruit_name, recruit_badge, phase,
          phase_start_date, requesting_fto_name, requesting_fto_badge,
          extension_type, requested_weeks, justification, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING ${columns}`,
        [
          input.id,
          userId,
          input.className,
          input.recruitName,
          input.recruitBadge,
          input.phase,
          input.phaseStartDate,
          input.requestingFtoName,
          input.requestingFtoBadge,
          input.extensionType,
          input.requestedWeeks,
          input.justification,
        ],
      );
      if (inserted.rows[0]) {
        return { request: toRequest(inserted.rows[0]), created: true };
      }

      const existing = await pool.query<RequestRow>(
        `SELECT ${columns} FROM phase_extension_requests WHERE id = $1`,
        [input.id],
      );
      const row = existing.rows[0];
      if (!row || row.requester_user_id !== userId) {
        throw new Error("PHASE_EXTENSION_ID_CONFLICT");
      }
      return { request: toRequest(row), created: false };
    },
    async review(id, reviewerUserId, decision) {
      const status = decision === "approve" ? "approved" : "denied";
      const result = await pool.query<RequestRow>(
        `UPDATE phase_extension_requests
         SET status = $2, reviewed_at = NOW(), reviewed_by_user_id = $3
         WHERE id = $1 AND status = 'pending'
         RETURNING ${columns}`,
        [id, status, reviewerUserId],
      );
      if (result.rows[0]) {
        return { request: toRequest(result.rows[0]), alreadyResolved: false };
      }
      const existing = await pool.query<RequestRow>(
        `SELECT ${columns} FROM phase_extension_requests WHERE id = $1`,
        [id],
      );
      return {
        request: existing.rows[0] ? toRequest(existing.rows[0]) : null,
        alreadyResolved: Boolean(existing.rows[0]),
      };
    },
  };
}
