import { Router, type RequestHandler } from "express";
import { UpdateOperationalProfileBody, ClearOperationalProfileBody, GetOperationalProfileHistoryQueryParams } from "@workspace/api-zod";
import { requireAgencyIdentity } from "../security/agencyIdentity.js";
import { getOperationalProfileStore, type OperationalProfileStore } from "../lib/operational-profile-store.js";
import { PacketError } from "../lib/packet-errors.js";

export function createOperationalProfileRouter(
  auth: RequestHandler = requireAgencyIdentity,
  resolveStore: () => OperationalProfileStore | null = getOperationalProfileStore,
) {
  const router = Router();
  router.use("/v1/account/operational-profile", auth, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["FTO", "PO"].includes(res.locals.agencyIdentity?.role)) {
      res.status(403).json({ error: "PROFILE_ACCESS_DENIED" }); return;
    }
    next();
  });
  router.get("/v1/account/operational-profile/history", async (req, res): Promise<void> => {
    const query = GetOperationalProfileHistoryQueryParams.strict().safeParse(req.query);
    if (!query.success) { res.status(400).json({ error: "INVALID_PROFILE_HISTORY_QUERY" }); return; }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.history(res.locals.agencyIdentity, query.data.beforeVersion));
    } catch (error) {
      res.status(error instanceof PacketError ? error.status : 503).json({
        error: error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE",
      });
    }
  });
  for (const method of ["get", "put"] as const) router[method]("/v1/account/operational-profile", async (req, res): Promise<void> => {
    const input = method === "put" ? UpdateOperationalProfileBody.strict().safeParse(req.body) : undefined;
    if (input && !input.success) { res.status(400).json({ error: "INVALID_OPERATIONAL_PROFILE" }); return; }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      res.json(input?.success
        ? await store.save(res.locals.agencyIdentity, input.data)
        : await store.read(res.locals.agencyIdentity));
    } catch (error) {
      const status = error instanceof PacketError ? error.status : 503;
      res.status(status).json({ error: error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE" });
    }
  });
  router.post("/v1/account/operational-profile/clear", async (req, res): Promise<void> => {
    const input = ClearOperationalProfileBody.strict().safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: "INVALID_OPERATIONAL_PROFILE" }); return; }
    try {
      const store = resolveStore();
      if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.clear(res.locals.agencyIdentity, input.data));
    } catch (error) {
      res.status(error instanceof PacketError ? error.status : 503)
        .json({ error: error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE" });
    }
  });
  return router;
}
export default createOperationalProfileRouter();
