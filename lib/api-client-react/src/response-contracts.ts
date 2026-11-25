import {
  GetOperationalProfileHistoryResponse, GetOperationalProfileResponse, UpdateOperationalProfileResponse,
  GetPacketReviewContextResponse, UpdatePacketCoordinatorResponse,
  ListPacketSubmissionsResponse, GetPacketSubmissionResponse, ActOnPacketSubmissionResponse,
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
  switch (`${method} ${pathname}`) {
    case "GET /api/v1/account/operational-profile/history": return GetOperationalProfileHistoryResponse.strict();
    case "GET /api/v1/account/operational-profile": return readProfile;
    case "PUT /api/v1/account/operational-profile": return saveProfile;
    case "POST /api/v1/account/operational-profile/clear": return saveProfile;
    case "GET /api/v1/packet-review/context": return GetPacketReviewContextResponse;
    case "PUT /api/v1/packet-review/coordinator": return UpdatePacketCoordinatorResponse;
    case "GET /api/v1/packet-review/submissions": return ListPacketSubmissionsResponse;
  }
  if (/^\/api\/v1\/packet-review\/submissions\/[0-9a-f-]{36}$/i.test(pathname)) {
    if (method === "GET") return GetPacketSubmissionResponse;
    if (method === "POST") return ActOnPacketSubmissionResponse;
  }
  return undefined;
}
