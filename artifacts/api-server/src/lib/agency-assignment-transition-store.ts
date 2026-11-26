import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type {
  AssignmentTransitionRecord,
  SuccessorAssignmentInput,
  TrustedTrainingAssignment,
  TrustedTrainingFto,
} from "@workspace/api-zod";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { PacketError } from "./packet-errors.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

type TransitionRow = {
  operation_id: string;
  occurred_at: string;
  class_name: string;
  po_name: string;
  po_badge: string;
  previous_assignment_id: string;
  successor_assignment_id: string;
  previous_phase: number;
  successor_phase: number;
  previous_fto_name: string;
  previous_fto_badge: string;
  successor_fto_name: string;
  successor_fto_badge: string;
  previous_ends_on: string;
  successor_starts_on: string;
  successor_ends_on: string;
};
type ScopedAssignmentRow = TrustedTrainingAssignment & { po_id: string };
type HistoryCursor = { occurred_at: string; operation_id: string };

function decodeHistoryCursor(value?: string): HistoryCursor | null {
  if (value === undefined) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (Buffer.from(decoded).toString("base64url") !== value ||
      typeof parsed !== "object" || parsed === null ||
      !("occurred_at" in parsed) || typeof parsed.occurred_at !== "string" ||
      !Number.isFinite(Date.parse(parsed.occurred_at)) ||
      !("operation_id" in parsed) || typeof parsed.operation_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.operation_id)) {
      throw new Error("Invalid cursor");
    }
    return { occurred_at: parsed.occurred_at, operation_id: parsed.operation_id };
  } catch {
    throw new PacketError(400, "INVALID_ASSIGNMENT_HISTORY_CURSOR");
  }
}

function encodeHistoryCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

const transitionColumns = `operation_id::text, occurred_at::text, class_name,
  po_name, po_badge, previous_assignment_id::text, successor_assignment_id::text,
  previous_phase, successor_phase,
  previous_snapshot->>'fto_name' AS previous_fto_name,
  previous_snapshot->>'fto_badge' AS previous_fto_badge,
  successor_snapshot->>'fto_name' AS successor_fto_name,
  successor_snapshot->>'fto_badge' AS successor_fto_badge,
  previous_ends_on::text, successor_starts_on::text, successor_ends_on::text`;

function toTransition(row: TransitionRow): AssignmentTransitionRecord {
  return {
    operation_id: row.operation_id,
    occurred_at: new Date(row.occurred_at),
    class_name: row.class_name,
    po_name: row.po_name,
    po_badge: row.po_badge,
    previous_assignment_id: row.previous_assignment_id,
    successor_assignment_id: row.successor_assignment_id,
    previous_phase: row.previous_phase,
    successor_phase: row.successor_phase,
    previous_fto_name: row.previous_fto_name,
    previous_fto_badge: row.previous_fto_badge,
    successor_fto_name: row.successor_fto_name,
    successor_fto_badge: row.successor_fto_badge,
    previous_ends_on: row.previous_ends_on,
    successor_starts_on: row.successor_starts_on,
    successor_ends_on: row.successor_ends_on,
  };
}

function transitionRequestHash(input: SuccessorAssignmentInput): string {
  return createHash("sha256").update(JSON.stringify({
    previous_assignment_id: input.previous_assignment_id,
    fto_id: input.fto_id,
    phase: input.phase,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
  })).digest("hex");
}

function throwTransitionError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  if (error instanceof PacketError) throw error;
  if (code === "42501") throw new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN");
  if (code === "P0002") throw new PacketError(403, "ASSIGNMENT_TRANSITION_SCOPE_REQUIRED");
  if (code === "23P01") throw new PacketError(409, "ASSIGNMENT_DATE_CONFLICT");
  if (code === "23505") throw new PacketError(409, "ASSIGNMENT_OPERATION_CONFLICT");
  if (code === "23514") throw new PacketError(422, "INVALID_SUCCESSOR_ASSIGNMENT");
  throw error;
}

export function createAgencyAssignmentTransitionStore(pool: pg.Pool) {
  return {
    async context(identity: AgencyIdentity) {
      if (identity.role !== "FTO_COORDINATOR") {
        throw new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN");
      }
      const idHash = hashUserIdentifier(identity.id);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const assignmentResult = await client.query<ScopedAssignmentRow>(
          `SELECT a.id::text, a.po_id, a.class_name, a.phase, a.fto_name, a.fto_badge,
             a.po_name, a.po_badge, a.starts_on::text, a.ends_on::text
           FROM agency_training.assignments a
            WHERE a.active AND a.po_id IS NOT NULL AND a.coordinator_id_hash IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM agency_training.assignment_transitions t
                WHERE t.previous_assignment_id = a.id
              )
             AND (
               EXISTS (
                 SELECT 1 FROM agency_training.po_coordinators pc
                 WHERE pc.po_id = a.po_id AND pc.po_id_hash = a.po_id_hash
                   AND pc.coordinator_id = $1
               )
               OR (
                 NOT EXISTS (
                   SELECT 1 FROM agency_training.po_coordinators pc
                   WHERE pc.po_id = a.po_id AND pc.po_id_hash = a.po_id_hash
                 )
                 AND a.coordinator_id_hash = $2
               )
             )
           ORDER BY a.class_name, a.po_name, a.po_badge, a.starts_on, a.phase`,
          [identity.id, idHash],
        );
        const poIds = [...new Set(assignmentResult.rows.map(row => row.po_id))];
        const classNames = [...new Set(assignmentResult.rows.map(row => row.class_name))];
        const ftoResult = classNames.length
          ? await client.query<TrustedTrainingFto>(
            `SELECT a.class_name, a.fto_id, min(a.fto_name) AS fto_name,
               min(a.fto_badge) AS fto_badge
             FROM agency_training.assignments a
             WHERE a.active AND a.class_name = ANY($1::text[])
               AND a.fto_id IS NOT NULL AND a.fto_name IS NOT NULL AND a.fto_badge IS NOT NULL
               AND a.fto_id_hash IS NOT NULL AND a.fto_badge_hash IS NOT NULL
             GROUP BY a.class_name, a.fto_id
             HAVING count(DISTINCT jsonb_build_array(a.fto_name, a.fto_badge,
               a.fto_id_hash, a.fto_badge_hash)) = 1
             ORDER BY a.class_name, min(a.fto_name), min(a.fto_badge)`,
            [classNames],
          )
          : { rows: [] as TrustedTrainingFto[] };
        const transitionResult = poIds.length
          ? await client.query<TransitionRow>(
            `SELECT ${transitionColumns}
             FROM agency_training.assignment_transitions
             WHERE po_id = ANY($1::text[])
             ORDER BY occurred_at DESC, operation_id DESC
             LIMIT 100`,
            [poIds],
          )
          : { rows: [] as TransitionRow[] };
        await client.query("COMMIT");
        return {
          available: true,
          role: identity.role,
          assignments: assignmentResult.rows.map(({ po_id: _poId, ...row }) => row),
          ftos: ftoResult.rows,
          transitions: transitionResult.rows.map(toTransition),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throwTransitionError(error);
      } finally {
        client.release();
      }
    },

    async history(
      identity: AgencyIdentity,
      assignmentId: string,
      cursorValue?: string,
      limit = 50,
    ) {
      if (identity.role !== "FTO_COORDINATOR") {
        throw new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN");
      }
      const cursor = decodeHistoryCursor(cursorValue);
      const idHash = hashUserIdentifier(identity.id);
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const scopeResult = await client.query<{ po_id: string }>(
          `SELECT a.po_id
           FROM agency_training.assignments a
           WHERE a.id = $1 AND a.active AND a.po_id IS NOT NULL
             AND a.coordinator_id_hash IS NOT NULL
             AND a.po_id_hash IS NOT NULL
             AND (
               EXISTS (
                 SELECT 1 FROM agency_training.po_coordinators pc
                 WHERE pc.po_id = a.po_id AND pc.po_id_hash = a.po_id_hash
                   AND pc.coordinator_id = $2
               )
               OR (
                 NOT EXISTS (
                   SELECT 1 FROM agency_training.po_coordinators pc
                   WHERE pc.po_id = a.po_id AND pc.po_id_hash = a.po_id_hash
                 )
                 AND a.coordinator_id_hash = $3
               )
             )
           LIMIT 1`,
          [assignmentId, identity.id, idHash],
        );
        const poId = scopeResult.rows[0]?.po_id;
        if (!poId) throw new PacketError(403, "ASSIGNMENT_TRANSITION_SCOPE_REQUIRED");

        const result = cursor
          ? await client.query<TransitionRow>(
            `SELECT ${transitionColumns}
             FROM agency_training.assignment_transitions
             WHERE po_id = $1
               AND (occurred_at, operation_id) < ($2::timestamptz, $3::uuid)
             ORDER BY occurred_at DESC, operation_id DESC
             LIMIT $4`,
            [poId, cursor.occurred_at, cursor.operation_id, limit + 1],
          )
          : await client.query<TransitionRow>(
            `SELECT ${transitionColumns}
             FROM agency_training.assignment_transitions
             WHERE po_id = $1
             ORDER BY occurred_at DESC, operation_id DESC
             LIMIT $2`,
            [poId, limit + 1],
          );
        const hasMore = result.rows.length > limit;
        const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
        const last = rows.at(-1);
        await client.query("COMMIT");
        return {
          transitions: rows.map(toTransition),
          next_cursor: hasMore && last
            ? encodeHistoryCursor({
              occurred_at: last.occurred_at,
              operation_id: last.operation_id,
            })
            : null,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throwTransitionError(error);
      } finally {
        client.release();
      }
    },

    async create(identity: AgencyIdentity, input: SuccessorAssignmentInput) {
      if (identity.role !== "FTO_COORDINATOR") {
        throw new PacketError(403, "ASSIGNMENT_TRANSITION_FORBIDDEN");
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const predecessor = await client.query<{ po_id: string }>(
          `SELECT po_id FROM agency_training.assignments
           WHERE id = $1 AND active AND po_id IS NOT NULL`,
          [input.previous_assignment_id],
        );
        const poId = predecessor.rows[0]?.po_id;
        if (!poId) throw new PacketError(403, "ASSIGNMENT_TRANSITION_SCOPE_REQUIRED");

        // Use the same per-PO advisory lock as Coordinator handoffs and phase
        // decisions, before the function rechecks the official roster scope.
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`po:${poId}`],
        );
        const result = await client.query<{ result_assignment_id: string; created: boolean }>(
          `SELECT * FROM agency_training.create_successor_assignment(
             $1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9::date, $10::date
           )`,
          [
            identity.id,
            hashUserIdentifier(identity.id),
            input.previous_assignment_id,
            randomUUID(),
            input.operation_id,
            transitionRequestHash(input),
            input.fto_id,
            input.phase,
            input.starts_on,
            input.ends_on,
          ],
        );
        const created = result.rows[0]?.created === true;
        const transition = await client.query<TransitionRow>(
          `SELECT ${transitionColumns}
           FROM agency_training.assignment_transitions
           WHERE operation_id = $1`,
          [input.operation_id],
        );
        if (!transition.rows[0]) throw new Error("Assignment transition audit row was not created.");
        await client.query("COMMIT");
        return { created, transition: toTransition(transition.rows[0]) };
      } catch (error) {
        await client.query("ROLLBACK");
        throwTransitionError(error);
      } finally {
        client.release();
      }
    },
  };
}

export type AgencyAssignmentTransitionStore =
  ReturnType<typeof createAgencyAssignmentTransitionStore>;

let store: AgencyAssignmentTransitionStore | undefined;

export function getAgencyAssignmentTransitionStore(): AgencyAssignmentTransitionStore | null {
  const pool = getAgencyDatabasePool();
  if (!pool) return null;
  store ??= createAgencyAssignmentTransitionStore(pool);
  return store;
}
