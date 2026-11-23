import { customFetch } from "@workspace/api-client-react";
import { apiEndpoint } from "@workspace/api-client-react";
import { SyncTrainingPacketsResponse } from "@workspace/api-zod";
import type { PendingChange, PacketBatchReceipt } from "./offlineStorage.js";

/** Only complete packet snapshots enter this transport; never a Workspace,
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
  return SyncTrainingPacketsResponse.parse(response).data;
}
