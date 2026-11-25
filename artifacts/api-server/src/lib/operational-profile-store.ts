import type pg from "pg";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { GetOperationalProfileHistoryResponse, GetOperationalProfileResponse, UpdateOperationalProfileBody } from "@workspace/api-zod";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { PacketError } from "./packet-errors.js";

function checkRole(identity: AgencyIdentity): asserts identity is AgencyIdentity & { role: "FTO" | "PO" } {
  if (identity.role !== "FTO" && identity.role !== "PO") throw new PacketError(403, "PROFILE_ACCESS_DENIED");
}
export function createOperationalProfileStore(pool: pg.Pool) {
  return {
    async history(identity: AgencyIdentity, beforeVersion?: number) {
      checkRole(identity);
      const result = await pool.query(
        `SELECT version,old_token,new_token,recorded_at,event
         FROM agency_training.operational_profile_history
         WHERE subject_hash=$1 AND ($2::integer IS NULL OR version < $2)
         ORDER BY version DESC LIMIT 51`,
        [hashUserIdentifier(identity.id), beforeVersion ?? null],
      );
      const page = result.rows.slice(0, 50);
      return GetOperationalProfileHistoryResponse.parse({
        subject: identity.id,
        entries: page.map(row => ({
          version: row.version, oldToken: row.old_token, newToken: row.new_token,
          recordedAt: new Date(row.recorded_at).toISOString(), event: row.event,
          actor: row.event === "baseline" ? "agency_migration" : "self",
        })),
        nextBeforeVersion: result.rows.length > 50 ? page[page.length - 1].version : null,
      });
    },
    async read(identity: AgencyIdentity) {
      checkRole(identity);
      const result = await pool.query(
        "SELECT assignment_token, version, updated_at FROM agency_training.operational_profiles WHERE subject_hash=$1",
        [hashUserIdentifier(identity.id)],
      );
      const row = result.rows[0];
      return GetOperationalProfileResponse.parse({
        subject: identity.id, role: identity.role, badge: identity.badge,
        identity: row ? parseOperationalIdentity(row.assignment_token) : null,
        version: row?.version ?? 0, ...(row ? { updatedAt: new Date(row.updated_at).toISOString() } : {}),
      });
    },
    async save(identity: AgencyIdentity, input: unknown) {
      checkRole(identity);
      const { assignmentToken, expectedVersion } = UpdateOperationalProfileBody.strict().parse(input);
      const derived = parseOperationalIdentity(assignmentToken);
      // Data-modifying CTEs commit the profile and evidence as one statement.
      // Row locking captures the actual prior token, including after a competing
      // writer commits. Failed compare-and-swap and no-op saves add no transition.
      const result = await pool.query(
        expectedVersion === 0
          ? `WITH saved AS (INSERT INTO agency_training.operational_profiles
            (subject_hash,assignment_token,district_token,cad_unit,company,side)
            VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (subject_hash) DO NOTHING
            RETURNING version,updated_at),
            evidence AS (INSERT INTO agency_training.operational_profile_history
              (subject_hash,version,old_token,new_token,actor_hash,recorded_at,event)
              SELECT $1,version,NULL,$2,$1,updated_at,'created' FROM saved)
            SELECT version,updated_at FROM saved`
          : `WITH prior AS (SELECT assignment_token FROM agency_training.operational_profiles
              WHERE subject_hash=$1 AND version=$7 FOR UPDATE),
            saved AS (UPDATE agency_training.operational_profiles AS profile SET assignment_token=$2,
            district_token=$3,cad_unit=$4,company=$5,side=$6,version=version+1,updated_at=clock_timestamp()
            FROM prior WHERE profile.subject_hash=$1 AND profile.version=$7
            RETURNING profile.version,profile.updated_at,prior.assignment_token AS old_token),
            evidence AS (INSERT INTO agency_training.operational_profile_history
              (subject_hash,version,old_token,new_token,actor_hash,recorded_at,event)
              SELECT $1,version,old_token,$2,$1,updated_at,'changed' FROM saved
              WHERE old_token IS DISTINCT FROM $2)
            SELECT version,updated_at FROM saved`,
        [hashUserIdentifier(identity.id), assignmentToken, derived.districtToken,
          derived.cadUnit, derived.company, derived.side ?? null, ...(expectedVersion ? [expectedVersion] : [])],
      );
      if (!result.rows[0]) throw new PacketError(409, "PROFILE_VERSION_CONFLICT");
      return GetOperationalProfileResponse.parse({
        subject: identity.id, role: identity.role, badge: identity.badge, identity: derived,
        version: result.rows[0].version, updatedAt: new Date(result.rows[0].updated_at).toISOString(),
      });
    },
  };
}
export function getOperationalProfileStore() {
  const pool = getAgencyDatabasePool();
  return pool ? createOperationalProfileStore(pool) : null;
}
export type OperationalProfileStore = ReturnType<typeof createOperationalProfileStore>;
