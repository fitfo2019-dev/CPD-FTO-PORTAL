import {
  getTestAdminScenario, listTestAdminAuditEvents,
  createTestAdminParticipant, updateTestAdminParticipant, deactivateTestAdminParticipant,
  createTestAdminClass, updateTestAdminClass, deactivateTestAdminClass,
  createTestAdminAssignment, updateTestAdminAssignment, deactivateTestAdminAssignment,
  listStagingTrainingRecords, createStagingTrainingRecord, updateStagingTrainingRecord,
} from "@workspace/api-client-react";
import {
  GetTestAdminScenarioResponse, ListTestAdminAuditEventsResponse, ListStagingTrainingRecordsResponse,
  CreateTestAdminParticipantBody, CreateTestAdminClassBody, CreateTestAdminAssignmentBody,
  CreateStagingTrainingRecordBody, UpdateStagingTrainingRecordBody,
} from "@workspace/api-zod";
import type {
  TestAdminParticipantInput, TestAdminClassInput, TestAdminAssignmentInput,
  TestAdminScenarioEnvelope, TestAdminAuditEvent, StagingTrainingRecord,
} from "@workspace/api-zod";
import { OperatorFacingError } from "@/lib/operator-errors.js";

export type Scenario = TestAdminScenarioEnvelope["data"];
export type AuditEvent = TestAdminAuditEvent;
export type TrainingRecord = StagingTrainingRecord;
export type ScenarioKind = "participants" | "classes" | "assignments";

const requestOptions = (signal?: AbortSignal): RequestInit => {
  const timeout = AbortSignal.timeout(15000);
  return { credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
};

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error ? Number(error.status) : undefined;
}
function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) return undefined;
  const data = (error as { data: unknown }).data;
  return typeof data === "object" && data !== null && "error_code" in data ? String(data.error_code) : undefined;
}

const MESSAGES: Record<string, string> = {
  VERSION_CONFLICT: "This record changed since it was opened. Reload and try again.",
  OPERATION_CONFLICT: "This record changed since it was opened. Reload and try again.",
  ROLE_CHANGE_NOT_ALLOWED: "A participant's role cannot be changed.",
  RECORDS_OUTSIDE_DATES: "Training records already exist outside those dates.",
  ALREADY_DEACTIVATED: "This item is already deactivated.",
  PARTICIPANT_NOT_AVAILABLE: "Select active participants with the matching role.",
  CLASS_NOT_AVAILABLE: "Select an active class.",
  INVALID_ASSIGNMENT_DATES: "Enter valid dates. The end date cannot be before the start date.",
  ASSIGNMENT_NOT_FOUND: "The date must fall inside an active assignment.",
  RECORD_NOT_FOUND: "This record is no longer available.",
};

/** Maps server failures to reviewed operator messages; never raw server text. */
export function testAdminError(error: unknown): OperatorFacingError {
  if (error instanceof OperatorFacingError) return error;
  const status = statusOf(error);
  const code = codeOf(error);
  if (code && MESSAGES[code]) return new OperatorFacingError(MESSAGES[code]);
  if (status === 401) return new OperatorFacingError("Sign in again with two-step verification.");
  if (status === 403 || status === 404) return new OperatorFacingError("Test Admin access is not available for this account.");
  if (status === 422) return new OperatorFacingError("Check the entries and try again.");
  return new OperatorFacingError("The synthetic staging service is unavailable.");
}

async function call<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw testAdminError(error); }
}

export const loadScenario = (signal?: AbortSignal) =>
  call(async () => GetTestAdminScenarioResponse.parse(await getTestAdminScenario(requestOptions(signal))).data);
export const loadAudit = (signal?: AbortSignal) =>
  call(async () => ListTestAdminAuditEventsResponse.parse(await listTestAdminAuditEvents(requestOptions(signal))).data);
export const loadRecords = (signal?: AbortSignal) =>
  call(async () => ListStagingTrainingRecordsResponse.parse(await listStagingTrainingRecords(requestOptions(signal))).data);

/** Server-authoritative probe: true only when the server grants Test Admin scope. */
export async function probeTestAdmin(signal?: AbortSignal): Promise<boolean> {
  try { await getTestAdminScenario(requestOptions(signal)); return true; } catch { return false; }
}

const scenario = async (response: Promise<unknown>) => GetTestAdminScenarioResponse.parse(await response).data;

export function saveParticipant(id: string | null, input: TestAdminParticipantInput) {
  const body = CreateTestAdminParticipantBody.strict().parse(input);
  return call(() => scenario(id ? updateTestAdminParticipant(id, body, requestOptions()) : createTestAdminParticipant(body, requestOptions())));
}
export function saveClass(id: string | null, input: TestAdminClassInput) {
  const body = CreateTestAdminClassBody.strict().parse(input);
  return call(() => scenario(id ? updateTestAdminClass(id, body, requestOptions()) : createTestAdminClass(body, requestOptions())));
}
export function saveAssignment(id: string | null, input: TestAdminAssignmentInput) {
  const body = CreateTestAdminAssignmentBody.strict().parse(input);
  return call(() => scenario(id ? updateTestAdminAssignment(id, body, requestOptions()) : createTestAdminAssignment(body, requestOptions())));
}
export function deactivate(kind: ScenarioKind, id: string) {
  const action = kind === "participants" ? deactivateTestAdminParticipant
    : kind === "classes" ? deactivateTestAdminClass : deactivateTestAdminAssignment;
  return call(() => scenario(action(id, requestOptions())));
}

export function createRecord(input: { assignment_id: string; record_date: string; narrative: string; status: "draft" | "submitted" }) {
  const body = CreateStagingTrainingRecordBody.strict().parse({ ...input, operation_id: crypto.randomUUID(), synthetic: true });
  return call(async () => ListStagingTrainingRecordsResponse.parse(await createStagingTrainingRecord(body, requestOptions())).data[0]);
}
export function updateRecord(id: string, input: { base_version: number; narrative: string; status: "draft" | "submitted" }) {
  const body = UpdateStagingTrainingRecordBody.strict().parse({ ...input, operation_id: crypto.randomUUID(), synthetic: true });
  return call(async () => ListStagingTrainingRecordsResponse.parse(await updateStagingTrainingRecord(id, body, requestOptions())).data[0]);
}
