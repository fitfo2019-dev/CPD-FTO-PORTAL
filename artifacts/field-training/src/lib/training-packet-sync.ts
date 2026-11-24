import { customFetch } from "@workspace/api-client-react";
import { apiEndpoint } from "@workspace/api-client-react";
import { GetTrainingPacketSyncReadinessResponse, ListTrainingPacketsResponse, SyncTrainingPacketsResponse, FinalizeTrainingPacketResponse } from "@workspace/api-zod";
import { z } from "zod";
import { MAX_PACKET_BATCH_COUNT, MAX_PACKET_REQUEST_BYTES, serializePacketBatchRequest,
  type PendingChange, type PacketBatchReceipt } from "./offlineStorage.js";

// Generated schemas otherwise strip complete-report fields such as signatures.
const sharedPacketsSchema = ListTrainingPacketsResponse.extend({
  metadata: ListTrainingPacketsResponse.shape.metadata.extend({
    has_more: z.boolean(),
    next_cursor: z.string().max(256).nullable(),
  }),
  data: ListTrainingPacketsResponse.shape.data.element.extend({
    report: ListTrainingPacketsResponse.shape.data.element.shape.report.passthrough(),
  }).array().max(100),
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
  const receipts=SyncTrainingPacketsResponse.parse(response).data;
  return Promise.all(receipts.map(async(receipt):Promise<PacketBatchReceipt>=>{
    if(receipt.sync_status==="local_draft_pending") return receipt;
    // An exact retry can observe a packet explicitly finalized on another
    // device. A sync receipt alone must never seal an editable local draft.
    const saved=await customFetch<unknown>(apiEndpoint(`/v1/training-packets/${encodeURIComponent(receipt.id)}`),{
      credentials:"same-origin",cache:"no-store",responseType:"json",signal:requestSignal(signal),
    });
    const authoritative=sharedPacketsSchema.parse(saved).data.find(item=>item.id===receipt.id);
    if(!authoritative || authoritative.sync_status!=="synchronized_complete" ||
      authoritative.server_version!==receipt.server_version)
      throw new Error("The server did not confirm an explicitly submitted packet. Local records were retained.");
    return {...receipt,submittedVerified:true};
  }));
}

/** Explicit action only. Never called by autosave, network events, or sync. */
export async function finalizePacketDraft(id:string,baseVersion:number,operationId:string,signal?:AbortSignal) {
  const response=await customFetch<unknown>(apiEndpoint(`/v1/training-packets/${encodeURIComponent(id)}/finalize`),{
    method:"POST",credentials:"same-origin",responseType:"json",
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),
    body:JSON.stringify({operation_id:operationId,base_version:baseVersion}),
  });
  const receipt=FinalizeTrainingPacketResponse.parse(response);
  if(receipt.id!==id||receipt.operation_id!==operationId||receipt.server_version!==baseVersion||
    receipt.sync_status!=="synchronized_complete")
    throw new Error("Invalid final-submission acknowledgement. The local record was retained.");
  return receipt;
}
