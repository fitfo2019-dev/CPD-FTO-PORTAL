import { SyncTrainingPacketsBody, ListTrainingPacketsResponse } from "@workspace/api-zod";
import { OperationalIdentitySnapshot } from "@workspace/api-zod/operational-profile";

// Orval currently strips undeclared properties on object schemas even when the
// OpenAPI contract permits them. Preserve the complete report, not a lossy
// summary. Recursive bounds and required structure are checked by the router.
export const CompletePacketReport = SyncTrainingPacketsBody.shape.packets.element.shape.report.extend({
  operationalIdentity: OperationalIdentitySnapshot.optional(),
}).loose();
export const CompletePacketInput = SyncTrainingPacketsBody.extend({
  packets: SyncTrainingPacketsBody.shape.packets.element.extend({
    report: CompletePacketReport,
  }).strict().array().min(1).max(100),
}).strict();
const packetRecordSchema = ListTrainingPacketsResponse.shape.data.element;
const packetAcknowledgmentSchema = packetRecordSchema.shape.acknowledgment.options[0].strict().nullable();
export const CompletePacketsEnvelope = ListTrainingPacketsResponse.extend({
  metadata: ListTrainingPacketsResponse.shape.metadata.strict(),
  data: packetRecordSchema.extend({
    report: CompletePacketReport.nullable(),
    acknowledgment: packetAcknowledgmentSchema,
  }).strict().array().max(100),
}).strict();
