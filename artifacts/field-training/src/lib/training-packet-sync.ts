import { customFetch } from "@workspace/api-client-react";
import { apiEndpoint } from "@workspace/api-client-react";
import { FinalizeTrainingPacketResponse, GetTrainingPacketSyncReadinessResponse,
  ListTrainingPacketsResponse, SyncTrainingPacketsResponse } from "@workspace/api-zod";
import type { PacketBatchReceipt, PacketFinalizationReceipt, PendingChange } from "./offlineStorage.js";
import { MAX_PACKET_BATCH_COUNT, MAX_PACKET_REQUEST_BYTES, serializePacketBatchRequest } from "./offlineStorage.js";
export { readSharedPackets, readSharedPacketsPage, createSharedPacketHistory, continueSharedPacketHistory,
  PacketHistoryCursorError } from "./packet-history.js";
export type { PacketHistoryFilters, SharedPacketHistory, SharedPacketPage } from "./packet-history.js";

// Generated schemas otherwise strip complete-report fields such as signatures.
const sharedPacketsSchema = ListTrainingPacketsResponse.extend({
  data: ListTrainingPacketsResponse.shape.data.element.extend({
    report: ListTrainingPacketsResponse.shape.data.element.shape.report.passthrough(),
  }).array().max(100),
});
export type SharedPacket = ReturnType<typeof sharedPacketsSchema.parse>["data"][number];

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Availability is not proof of an active roster assignment or final submission. */
export async function checkPacketService(signal?: AbortSignal): Promise<boolean> {
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets/sync-readiness"), {
    credentials: "same-origin", cache: "no-store", responseType: "json", signal: requestSignal(signal),
  });
  // Readiness does not authorize a transition; the server verifies each draft and finalization.
  return GetTrainingPacketSyncReadinessResponse.parse(response).metadata.service_available;
}

/** Only complete packet snapshots enter this transport; never a Workspace,
 * roster, chat draft, local key, or browser-provided assignment authority. */
export async function uploadPacketBatch(
  changes: PendingChange[], signal?: AbortSignal,
): Promise<PacketBatchReceipt[]> {
  if (!changes.length || changes.length > MAX_PACKET_BATCH_COUNT) throw new Error("Sync supports 1–100 packets per batch.");
  const body = serializePacketBatchRequest(changes);
  if (new TextEncoder().encode(body).byteLength > MAX_PACKET_REQUEST_BYTES)
    throw new Error("The serialized packet batch exceeds the 2 MB sync request limit.");
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets/sync"), {
    method: "POST", credentials: "same-origin", responseType: "json",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    body,
  });
  return SyncTrainingPacketsResponse.parse(response).data;
}

/** Finalization is a separate, explicit transition; it never changes PO review state. */
export async function finalizePacket(
  id: string, operationId: string, contentHash: string, signal?: AbortSignal,
): Promise<PacketFinalizationReceipt> {
  const response = await customFetch<unknown>(
    apiEndpoint(`/v1/training-packets/${encodeURIComponent(id)}/finalize`), {
      method: "POST", credentials: "same-origin", responseType: "json",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      body: JSON.stringify({ operation_id: operationId, content_hash: contentHash }),
    },
  );
  const parsed = FinalizeTrainingPacketResponse.parse(response);
  const packet = parsed.data.find(item => item.id === id);
  if (!packet || packet.sync_status !== "submitted_complete")
    throw new Error("The server did not confirm packet finalization.");
  return { id: packet.id, server_version: packet.server_version,
    sync_status: "submitted_complete", content_hash: packet.content_hash };
}
