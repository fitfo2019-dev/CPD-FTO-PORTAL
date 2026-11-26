import {
  createSuccessorAssignment,
  getAssignmentTransitionHistory,
  getAssignmentTransitionContext,
} from "@workspace/api-client-react";
import {
  CreateSuccessorAssignmentBody,
  CreateSuccessorAssignmentResponse,
  GetAssignmentTransitionHistoryResponse,
  GetAssignmentTransitionContextResponse,
} from "@workspace/api-zod";
import type { SuccessorAssignmentInput } from "@workspace/api-zod";

function timedSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(15000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function loadOfficialAssignmentTransitionContext(signal?: AbortSignal) {
  const response = await getAssignmentTransitionContext({
    credentials: "same-origin",
    cache: "no-store",
    signal: timedSignal(signal),
  });
  return GetAssignmentTransitionContextResponse.parse(response);
}

export async function loadOfficialAssignmentTransitionHistory(
  assignmentId: string,
  cursor?: string,
  signal?: AbortSignal,
) {
  const response = await getAssignmentTransitionHistory(
    { assignmentId, cursor, limit: 50 },
    {
      credentials: "same-origin",
      cache: "no-store",
      signal: timedSignal(signal),
    },
  );
  return GetAssignmentTransitionHistoryResponse.parse(response);
}

export async function submitOfficialSuccessorAssignment(
  input: SuccessorAssignmentInput,
  signal?: AbortSignal,
) {
  const body = CreateSuccessorAssignmentBody.strict().parse(input);
  const response = await createSuccessorAssignment(body, {
    credentials: "same-origin",
    cache: "no-store",
    signal: timedSignal(signal),
  });
  return CreateSuccessorAssignmentResponse.parse(response);
}

export function assignmentTransitionError(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : undefined;
  const code = typeof error === "object" && error !== null && "error_code" in error
    ? String(error.error_code)
    : "";
  if (status === 401) return "Sign in again with your verified Coordinator account.";
  if (status === 403) return "Your verified account is not assigned to manage this PO.";
  if (status === 400 || status === 422) return "Check the selected FTO, phase, and effective date.";
  if (status === 409) return "This PO already has a conflicting successor assignment. Refresh the official roster before trying again.";
  if (status === 503) return "The official agency roster is unavailable. No assignment or packet was changed.";
  if (code === "AGENCY_STORAGE_UNAVAILABLE") return "The official agency roster is unavailable. No assignment or packet was changed.";
  return "The server did not confirm this assignment change. Retry the same request; do not assume it completed.";
}
