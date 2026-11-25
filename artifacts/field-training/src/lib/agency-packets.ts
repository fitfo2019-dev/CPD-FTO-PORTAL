import { listTrainingPackets, releaseTrainingPacket,
  acknowledgeTrainingPacket, withdrawTrainingPacket } from "@workspace/api-client-react";
import { ListTrainingPacketsResponse, ReleaseTrainingPacketBody,
  AcknowledgeTrainingPacketBody, WithdrawTrainingPacketBody } from "@workspace/api-zod";
import { z } from "zod/v4";

// Preserve complete uploaded snapshots, not just the generated summary fields.
const packetRecordSchema = ListTrainingPacketsResponse.shape.data.element;
const fullReportSchema = z.union([
  packetRecordSchema.shape.report.options[0].passthrough(),
  z.null(),
]);
export const agencyPacketsEnvelope = ListTrainingPacketsResponse.extend({
  data: packetRecordSchema.extend({ report: fullReportSchema }).array().max(100),
});
export type AgencyPacketsEnvelope = z.infer<typeof agencyPacketsEnvelope>;
export type AgencyPacket = AgencyPacketsEnvelope["data"][number];
export type PacketReviewAction = "release" | "withdraw" | "acknowledge";
export type PacketReviewDraft = { action: PacketReviewAction; comments?: string; reason?: string };
export type PacketReviewCommand = {
  packetId: string; action: PacketReviewAction; input: {
    operation_id: string; content_hash: string; review_confirmed?: true;
    comments?: string; reason?: string;
  };
};

export function createPacketReviewCommand(packet: AgencyPacket, draft: PacketReviewDraft): PacketReviewCommand {
  const input = { operation_id: crypto.randomUUID(), content_hash: packet.content_hash };
  return { packetId: packet.id, action: draft.action, input: draft.action === "withdraw"
    ? { ...input, reason: draft.reason }
    : { ...input, review_confirmed: true, ...(draft.action === "acknowledge" ? { comments: draft.comments ?? "" } : {}) } };
}

export async function loadAgencyPackets(signal?: AbortSignal): Promise<AgencyPacketsEnvelope> {
  return agencyPacketsEnvelope.parse(await listTrainingPackets(undefined, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  }));
}

export async function performPacketReview(command: PacketReviewCommand, signal?: AbortSignal): Promise<AgencyPacketsEnvelope> {
  const timeout = AbortSignal.timeout(15000);
  const options = { signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
  const result = command.action === "release"
    ? await releaseTrainingPacket(command.packetId, ReleaseTrainingPacketBody.strict().parse(command.input), options)
    : command.action === "withdraw"
      ? await withdrawTrainingPacket(command.packetId, WithdrawTrainingPacketBody.strict().parse(command.input), options)
      : await acknowledgeTrainingPacket(command.packetId, AcknowledgeTrainingPacketBody.strict().parse(command.input), options);
  return agencyPacketsEnvelope.parse(result);
}

/** A lost response is reconciled with authoritative packet metadata before a
 * retry. This does not infer success from an uploaded report signature/status. */
export function packetCommandSatisfied(command: PacketReviewCommand, packet: AgencyPacket): boolean {
  if (packet.id !== command.packetId || packet.content_hash !== command.input.content_hash) return false;
  if (command.action === "release") return packet.released_to_po && !packet.withdrawn_at;
  if (command.action === "withdraw") return Boolean(packet.withdrawn_at) && packet.withdrawal_reason === command.input.reason;
  return packet.acknowledgment?.content_hash === command.input.content_hash &&
    packet.acknowledgment.comments === (command.input.comments ?? "");
}

export function packetReviewError(error: unknown): string {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  if (status === 401) return "Sign in again to access agency packets.";
  if (status === 403) return "Your verified agency account does not have access to this action.";
  if (status === 404) return "This packet is no longer available to your agency account. It may have been withdrawn.";
  if (status === 409) return "The packet changed or this action was already recorded. Refresh and review its current state.";
  if (status === 400) return "Review the confirmation and required fields before continuing.";
  return "The agency service could not confirm the result. Refresh or retry the same pending action; do not assume it failed.";
}
