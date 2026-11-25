import { customFetch } from "@workspace/api-client-react";
import { apiEndpoint } from "@workspace/api-client-react";
import { FinalizeTrainingPacketResponse, GetTrainingPacketSyncReadinessResponse, ListTrainingPacketsResponse,
  SyncTrainingPacketsResponse } from "@workspace/api-zod";
import { z } from "zod/v4";
import { MAX_PACKET_BATCH_COUNT, MAX_PACKET_REQUEST_BYTES, serializePacketBatchRequest,
  type PendingChange, type PacketBatchReceipt } from "./offlineStorage.js";
export { createSharedPacketHistory, continueSharedPacketHistory, PacketHistoryCursorError } from "./packet-history.js";
export type { PacketHistoryFilters, SharedPacketHistory } from "./packet-history.js";

// Generated schemas otherwise strip complete-report fields such as signatures.
const packetRecordSchema = ListTrainingPacketsResponse.shape.data.element;
const fullReportSchema = z.union([
  packetRecordSchema.shape.report.options[0].passthrough(),
  z.null(),
]);
const sharedPacketsSchema = ListTrainingPacketsResponse.extend({
  metadata: ListTrainingPacketsResponse.shape.metadata.extend({
    has_more: z.boolean(),
    next_cursor: z.string().max(256).nullable(),
  }),
  data: packetRecordSchema.extend({ report: fullReportSchema }).array().max(100),
});
export type SharedPacket = ReturnType<typeof sharedPacketsSchema.parse>["data"][number];
export type SharedPacketPage = {
  data: SharedPacket[];
  hasMore: boolean;
  nextCursor: string | null;
};

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Explicit read only. Availability is not proof of network or assignment. */
export async function checkPacketService(signal?: AbortSignal): Promise<boolean> {
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets/sync-readiness"), {
    credentials: "same-origin", cache: "no-store", responseType: "json", signal: requestSignal(signal),
  });
  // Even if automatic_sync_allowed changes server-side, this client never auto-uploads.
  return GetTrainingPacketSyncReadinessResponse.parse(response).metadata.can_sync;
}

/** Fetch one bounded authorized history page. */
export async function readSharedPacketsPage(cursor?: string, signal?: AbortSignal): Promise<SharedPacketPage> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await customFetch<unknown>(apiEndpoint(`/v1/training-packets${query}`), {
    credentials: "same-origin", cache: "no-store", responseType: "json", signal: requestSignal(signal),
  });
  const page = sharedPacketsSchema.parse(response);
  if (page.metadata.has_more !== Boolean(page.metadata.next_cursor))
    throw new Error("The agency packet history returned invalid continuation metadata.");
  return {
    data: page.data,
    hasMore: page.metadata.has_more,
    nextCursor: page.metadata.next_cursor,
  };
}

/** Returned copies stay separate from the encrypted local workspace. */
export async function readSharedPackets(signal?: AbortSignal): Promise<SharedPacket[]> {
  const data: SharedPacket[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await readSharedPacketsPage(cursor, signal);
    data.push(...page.data);
    if (!page.hasMore) return data;
    const nextCursor = page.nextCursor;
    if (!nextCursor || seenCursors.has(nextCursor))
      throw new Error("The agency packet history could not be continued safely.");
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

/** Packet snapshots enter draft storage only; never official submission, a Workspace,
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
  const receipts = SyncTrainingPacketsResponse.parse(response).data;
  if (receipts.some(receipt => receipt.sync_status !== "local_draft_pending"))
    throw new Error("Draft synchronization cannot submit or seal a packet. The local record was retained.");
  return receipts as PacketBatchReceipt[];
}

/** Explicit action only. Never called by autosave, network events, or sync. */
export async function finalizePacket(
  id: string, operationId: string, contentHash: string, baseVersion: number, signal?: AbortSignal,
) {
  const response=await customFetch<unknown>(apiEndpoint(`/v1/training-packets/${encodeURIComponent(id)}/finalize`),{
    method:"POST",credentials:"same-origin",responseType:"json",
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),
    body:JSON.stringify({operation_id:operationId,base_version:baseVersion,content_hash:contentHash}),
  });
  const receipt=FinalizeTrainingPacketResponse.parse(response);
  if(receipt.id!==id||receipt.operation_id!==operationId||receipt.server_version!==baseVersion||
    receipt.sync_status!=="submitted_complete"||receipt.content_hash!==contentHash)
    throw new Error("Invalid final-submission acknowledgement. The local record was retained.");
  return receipt;
}
