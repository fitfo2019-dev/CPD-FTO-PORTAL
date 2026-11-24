import type pg from "pg";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { GetOperationalProfileResponse, UpdateOperationalProfileBody } from "@workspace/api-zod";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import { getAgencyDatabasePool } from "./agency-database.js";
import { PacketError } from "./packet-errors.js";

function checkRole(identity: AgencyIdentity): asserts identity is AgencyIdentity & { role: "FTO" | "PO" } {
  if (identity.role !== "FTO" && identity.role !== "PO") throw new PacketError(403, "PROFILE_ACCESS_DENIED");
}
export function createOperationalProfileStore(pool: pg.Pool) {
  return {
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
      // One SQL statement: concurrent creation and compare-and-swap updates
      // cannot partially write the token or its derived columns.
      const result = await pool.query(
        expectedVersion === 0
          ? `INSERT INTO agency_training.operational_profiles
            (subject_hash,assignment_token,district_token,cad_unit,company,side)
            VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (subject_hash) DO NOTHING
            RETURNING version,updated_at`
          : `UPDATE agency_training.operational_profiles SET assignment_token=$2,
            district_token=$3,cad_unit=$4,company=$5,side=$6,version=version+1,updated_at=clock_timestamp()
            WHERE subject_hash=$1 AND version=$7 RETURNING version,updated_at`,
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
