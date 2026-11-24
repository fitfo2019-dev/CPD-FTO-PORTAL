import { Router, json, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { SyncTrainingPacketsResponse, GetTrainingPacketParams, ReleaseTrainingPacketBody,
  AcknowledgeTrainingPacketBody, WithdrawTrainingPacketBody, FinalizeTrainingPacketBody } from "@workspace/api-zod";
import { PatrolAssignmentMetadataSchema } from "@workspace/api-zod/patrol-assignment";
import { CompletePacketInput, CompletePacketsEnvelope } from "../lib/packet-contract.js";
import { requireAgencyIdentity, type AgencyIdentity } from "../security/agencyIdentity.js";
import { encodePacketCursor, getAgencyPacketStore, PacketError, type AgencyPacketStore, type PacketReviewAction } from "../lib/agency-packet-store.js";
import { recordPayloadSize } from "../middlewares/audit-request.js";

/** A bounded JSON tree rejects prototype keys, embedded file bytes and
 * control characters without corrupting legitimate prose or apostrophes. */
export function safePacketTree(value: unknown, depth = 0): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 1e12;
  if (typeof value === "string")
    return value.length <= 100000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) &&
      !value.startsWith("data:") && !/<script[\s>]/i.test(value);
  if (Array.isArray(value)) return value.length <= 2000 && value.every(item => safePacketTree(item, depth + 1));
  if (typeof value !== "object") return false;
  const entries = Object.entries(value);
  return entries.length <= 500 && entries.every(([key, item]) =>
    !["__proto__", "constructor", "prototype"].includes(key) && key.length <= 160 &&
    safePacketTree(item, depth + 1));
}

export function createTrainingPacketsRouter(
  authenticate: RequestHandler = requireAgencyIdentity,
  resolveStore: () => AgencyPacketStore | null = getAgencyPacketStore,
) {
  const router = Router();
  router.use("/v1/training-packets", authenticate);
  router.use("/v1/training-packets", json({ limit: "2mb", inflate: false,
    verify(req, _res, buffer) { recordPayloadSize(req, buffer.byteLength); } }));
  router.get("/v1/training-packets/sync-readiness", (_req, res) => {
    // A browser's online flag does not prove a trusted city-network boundary.
    // Automatic transmission stays off; only explicit authenticated sync is supported.
    res.json({ status: "success", metadata: { can_sync: Boolean(resolveStore()) },
      data: [{ automatic_sync_allowed: false }] });
  });
  for (const action of ["release", "withdraw", "acknowledge"] as const satisfies readonly PacketReviewAction[]) {
    const schema = action === "release" ? ReleaseTrainingPacketBody.strict() :
      action === "withdraw" ? WithdrawTrainingPacketBody.strict() : AcknowledgeTrainingPacketBody.strict();
    router.post(`/v1/training-packets/:id/${action}`, async (req, res): Promise<void> => {
      const identity = res.locals.agencyIdentity as AgencyIdentity;
      if (identity.role !== (action === "acknowledge" ? "PO" : "FTO_COORDINATOR")) {
        sendPacketError(res, new PacketError(403, "PACKET_REVIEW_FORBIDDEN"));
        return;
      }
      const params = GetTrainingPacketParams.safeParse(req.params);
      const body = schema.safeParse(req.body);
      if (!params.success || !body.success || !safePacketTree(req.body) ||
        ("reason" in body.data && !body.data.reason?.trim())) {
        sendPacketError(res, new PacketError(400, "INVALID_PACKET_REVIEW"));
        return;
      }
      try {
        const store = resolveStore();
        if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
        const data = await store.review(identity, {
          requestId: typeof req.id === "string" ? req.id : randomUUID(),
          clientIp: req.ip || req.socket.remoteAddress || "unknown",
        }, params.data.id, action, body.data);
        res.json(CompletePacketsEnvelope.parse({
          status: "success", metadata: { total_records: data.length, role: identity.role }, data,
        }));
      } catch (error) { sendPacketError(res, error); }
    });
  }
  router.post("/v1/training-packets/sync", async (req, res) => {
    const identity = res.locals.agencyIdentity as AgencyIdentity;
    if (identity.role !== "FTO") {
      res.status(403).json({ status: "error", error_code: "PACKET_SYNC_FORBIDDEN",
        message: "Only the assigned FTO may upload a training packet." });
      return;
    }
    const parsed = CompletePacketInput.safeParse(req.body);
    if (!parsed.success || !safePacketTree(req.body) ||
      new Set(parsed.data.packets.map(item => item.report.id)).size !== parsed.data.packets.length ||
      new Set(parsed.data.packets.map(item => item.operation_id)).size !== parsed.data.packets.length ||
      parsed.data.packets.some(item =>
        Boolean(item.amendment_of) !== Boolean(item.amendment_reason?.trim()) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.report.date) ||
        Number.isNaN(Date.parse(item.report.date)) ||
        new Date(item.report.date).toISOString().slice(0, 10) !== item.report.date ||
        !completeReportStructure(item.report) ||
        !item.report.runs.every(run => typeof run.id === "string"))) {
      res.status(400).json({ status: "error", error_code: "INVALID_PACKET",
        message: "The packet batch is incomplete or invalid." });
      return;
    }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      const data = await store.sync(identity, {
        requestId: typeof req.id === "string" ? req.id : randomUUID(),
        clientIp: req.ip || req.socket.remoteAddress || "unknown",
      }, parsed.data.packets);
      res.json(SyncTrainingPacketsResponse.parse({
        status: "success", metadata: { total_records: data.length, role: identity.role }, data,
      }));
    } catch (error) { sendPacketError(res, error); }
  });
  router.get(["/v1/training-packets", "/v1/training-packets/:id"], async (req, res) => {
    const id = req.params.id;
    if (id !== undefined && !GetTrainingPacketParams.safeParse({ id }).success) {
      res.status(400).json({ status: "error", error_code: "INVALID_PACKET_ID",
        message: "The packet identifier is invalid." });
      return;
    }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      const identity = res.locals.agencyIdentity as AgencyIdentity;
      if (typeof id !== "string") {
        const rawCursor = req.query.cursor;
        if (rawCursor !== undefined && typeof rawCursor !== "string")
          throw new PacketError(400, "INVALID_PACKET_CURSOR");
        const page = await store.readPage(identity, {
          requestId: typeof req.id === "string" ? req.id : randomUUID(),
          clientIp: req.ip || req.socket.remoteAddress || "unknown",
        }, rawCursor);
        let data = page.data;
        let hasMore = page.hasMore;
        const makeResponse = () => ({
          status: "success" as const,
          metadata: {
            total_records: data.length,
            role: identity.role,
            has_more: hasMore,
            next_cursor: hasMore && data.length
              ? encodePacketCursor(String(data.at(-1)!.record_date), String(data.at(-1)!.id))
              : null,
          },
          data,
        });
        let response = makeResponse();
        while (data.length && Buffer.byteLength(JSON.stringify(response), "utf8") > 2 * 1024 * 1024) {
          data = data.slice(0, -1);
          hasMore = true;
          response = makeResponse();
        }
        if (page.data.length && !data.length)
          throw new PacketError(413, "PACKET_RECORD_EXCEEDS_PAGE_SIZE");
        CompletePacketsEnvelope.parse(response);
        res.setHeader("Cache-Control", "no-store");
        res.json(response);
        return;
      }
      const data = await store.read(identity, {
        requestId: typeof req.id === "string" ? req.id : randomUUID(),
        clientIp: req.ip || req.socket.remoteAddress || "unknown",
      }, typeof id === "string" ? id : undefined);
      res.json(CompletePacketsEnvelope.parse({
        status: "success", metadata: { total_records: data.length, role: identity.role,
          has_more: false, next_cursor: null }, data,
      }));
    } catch (error) { sendPacketError(res, error); }
  });
  router.post("/v1/training-packets/:id/finalize", async (req,res)=>{
    const parsed=FinalizeTrainingPacketBody.safeParse(req.body);
    const params=GetTrainingPacketParams.safeParse(req.params);
    if(!parsed.success||!params.success) {
      res.status(400).json({status:"error",error_code:"INVALID_PACKET_FINALIZATION",message:"Invalid packet finalization."});
      return;
    }
    try {
      const store=resolveStore();
      if(!store) throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
      const receipt=await store.finalize(res.locals.agencyIdentity as AgencyIdentity,params.data.id,
        parsed.data.operation_id,parsed.data.base_version,{
          requestId:typeof req.id==="string"?req.id:randomUUID(),
          clientIp:req.ip||req.socket.remoteAddress||"unknown",
        });
      res.json(receipt);
    } catch(error) {sendPacketError(res,error);}
  });
  return router;
}
function sendPacketError(res: import("express").Response, error: unknown): void {
  res.status(error instanceof PacketError ? error.status : 503).json({
    status: "error", error_code: error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE",
    message: "The packet operation could not be completed. Local drafts have not been removed.",
  });
}
export default createTrainingPacketsRouter();

export const PACKET_SEG_KEYS = [
  "dutyReadiness", "communicationsUsage", "publicPoliceInteraction", "feedbackAcceptance",
  "precinctOrientation", "routineDriving", "emergencyPursuit", "policiesProcedures",
  "criminalTrafficCodes", "arrestSearchSeizure", "informationGathering", "resourceEquipmentUsage",
  "formUsage", "grammarLegibility", "contentAccuracy", "completionTime", "responseToEnforcement",
  "threatAssessment", "initiatingArrests", "handlingPrisoners", "vehicleStops", "runApproach",
  "buildingSearch", "patDownSearches", "lowStressSituations", "stressSituations",
  "arrestSituations", "problemSolving", "motivationalTraits", "taskManagement",
] as const;
function completeReportStructure(report: Record<string, unknown>): boolean {
  if(report.ftoAssignment &&
    !PatrolAssignmentMetadataSchema.safeParse(report).success) return false;
  for (const key of ["shift", "zone", "precinct", "cruiserDistrict", "createdAt", "updatedAt"]) {
    if (typeof report[key] !== "string" || (report[key] as string).length > 120) return false;
  }
  for (const key of ["signatures", "activity", "ratings", "reportingForDuty"]) {
    if (typeof report[key] !== "object" || report[key] === null || Array.isArray(report[key])) return false;
  }
  const duty = report.reportingForDuty as Record<string, unknown>;
  if (typeof duty.notes !== "string" ||
    !["on_duty", "training", "sick", "off_duty", "other"].includes(String(duty.dutyStatus)) ||
    (duty.shotgunTraining !== undefined && !["Y", "N"].includes(String(duty.shotgunTraining))) ||
    !duty.checklist || typeof duty.checklist !== "object" || Array.isArray(duty.checklist) ||
    !Object.values(duty.checklist).every(value => typeof value === "boolean")) return false;
  const ratings = report.ratings as Record<string, unknown>;
  if (Object.keys(ratings).length !== 30 || !PACKET_SEG_KEYS.every(key => Object.hasOwn(ratings, key))) return false;
  if (!Array.isArray(report.runs) || !report.runs.every(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const run = value as Record<string, unknown>;
    for (const key of ["id", "occurredAt", "runKind", "trafficMode", "formStatus", "narrative"]) {
      if (typeof run[key] !== "string") return false;
    }
    for (const key of ["isDispatched", "arrestMade", "transportedAfterArrest", "oviProcessed", "narrativeAdditionRequired"]) {
      if (typeof run[key] !== "boolean") return false;
    }
    return run.checklist !== null && typeof run.checklist === "object" &&
      !Array.isArray(run.checklist) && Object.values(run.checklist).every(checked => typeof checked === "boolean");
  })) return false;
  return Object.values(ratings).every(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const entry = value as Record<string, unknown>;
    return ["", "NO", "A", "RT", "UA", "NRT"].includes(String(entry.rating)) &&
      typeof entry.justification === "string";
  });
}
