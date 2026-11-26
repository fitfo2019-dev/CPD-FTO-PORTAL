import {
  GetOperationalProfileHistoryResponse, GetOperationalProfileResponse, UpdateOperationalProfileResponse,
  GetPacketReviewContextResponse, UpdatePacketCoordinatorResponse,
  ListPacketSubmissionsResponse, GetPacketSubmissionResponse, ActOnPacketSubmissionResponse,
  FinalizeTrainingPacketResponse,
  GetAssignmentTransitionContextResponse,
  GetAssignmentTransitionHistoryResponse,
  GetTestAdminScenarioResponse,
} from "@workspace/api-zod";
import { OperationalIdentitySnapshot } from "@workspace/api-zod/operational-profile";

type ResponseSchema = { safeParse(value: unknown): { success: boolean } };
// Former full-unit derivations are historical only. CAD does not read sides.
const liveIdentity = OperationalIdentitySnapshot.refine(identity => identity.districtToken !== undefined
  && identity.cadUnit === identity.assignmentToken.slice(0, 5), "The active CAD profile must omit the internal side.");
const readProfile = GetOperationalProfileResponse.extend({ identity: liveIdentity.nullable() }).strict();
const saveProfile = UpdateOperationalProfileResponse.extend({ identity: liveIdentity.nullable() }).strict();

/** These OpenAPI operations return objects, not the legacy success envelope.
 * Keep the allowlist method/path-specific; never accept arbitrary raw API JSON.
 * Validate without returning Zod's output: date coercion must not change the
 * generated client's documented JSON string types. */
export function objectResponseContract(method: string, pathname: string): ResponseSchema | undefined {
  if (method === "POST" && /^\/api\/v1\/training-packets\/[^/]+\/finalize$/.test(pathname))
    return FinalizeTrainingPacketResponse;
  switch (`${method} ${pathname}`) {
    case "GET /api/v1/account/operational-profile/history": return GetOperationalProfileHistoryResponse.strict();
    case "GET /api/v1/account/operational-profile": return readProfile;
    case "PUT /api/v1/account/operational-profile": return saveProfile;
    case "POST /api/v1/account/operational-profile/clear": return saveProfile;
    case "GET /api/v1/packet-review/context": return GetPacketReviewContextResponse;
    case "GET /api/v1/agency/assignment-transitions/context": return GetAssignmentTransitionContextResponse;
    case "GET /api/v1/agency/assignment-transitions/history": return GetAssignmentTransitionHistoryResponse;
    case "PUT /api/v1/packet-review/coordinator": return UpdatePacketCoordinatorResponse;
    case "GET /api/v1/packet-review/submissions": return ListPacketSubmissionsResponse;
  }
  // Synthetic staging scenario: every read and write returns the scenario snapshot.
  if (/^\/api\/v1\/staging\/test-admin\/(scenario|(participants|classes|assignments)(\/[0-9a-f-]{36}(\/deactivation)?)?)$/i.test(pathname)
    && (method === "GET" || method === "POST" || method === "PUT"))
    return GetTestAdminScenarioResponse.strict();
  if (/^\/api\/v1\/packet-review\/submissions\/[0-9a-f-]{36}$/i.test(pathname)) {
    if (method === "GET") return GetPacketSubmissionResponse;
    if (method === "POST") return ActOnPacketSubmissionResponse;
  }
  return undefined;
}
