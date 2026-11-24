import { customFetch } from "@workspace/api-client-react";
import { apiEndpoint } from "@workspace/api-client-react";
import { GetTrainingPacketSyncReadinessResponse, ListTrainingPacketsResponse, SyncTrainingPacketsResponse, FinalizeTrainingPacketResponse } from "@workspace/api-zod";
import type { PendingChange, PacketBatchReceipt } from "./offlineStorage.js";

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

/** Explicit read only. Availability is not proof of network or assignment. */
export async function checkPacketService(signal?: AbortSignal): Promise<boolean> {
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets/sync-readiness"), {
    credentials: "same-origin", cache: "no-store", responseType: "json", signal: requestSignal(signal),
  });
  // Even if automatic_sync_allowed changes server-side, this client never auto-uploads.
  return GetTrainingPacketSyncReadinessResponse.parse(response).metadata.can_sync;
}

/** Returned copies stay separate from the encrypted local workspace. */
export async function readSharedPackets(signal?: AbortSignal): Promise<SharedPacket[]> {
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets"), {
    credentials: "same-origin", cache: "no-store", responseType: "json", signal: requestSignal(signal),
  });
  return sharedPacketsSchema.parse(response).data;
}

/** Packet snapshots enter draft storage only; never official submission, a Workspace,
 * roster, chat draft, local key, or browser-provided assignment authority. */
export async function uploadPacketBatch(
  changes: PendingChange[], signal?: AbortSignal,
): Promise<PacketBatchReceipt[]> {
  if (!changes.length || changes.length > 100) throw new Error("Sync supports 1–100 packets per batch.");
  const response = await customFetch<unknown>(apiEndpoint("/v1/training-packets/sync"), {
    method: "POST", credentials: "same-origin", responseType: "json",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    body: JSON.stringify({ packets: changes.map(change => ({
      operation_id: change.operationId, base_version: change.baseVersion, report: change.value,
    })) }),
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
