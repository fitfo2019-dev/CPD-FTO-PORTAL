import { Router, type RequestHandler, type Response } from "express";
import { clerkClient } from "@clerk/express";
import {
  CloseTrainingAlertBody, CloseTrainingAlertParams, CreateNrtReviewRequestBody,
  ListTrainingAlertsQueryParams, SaveWeek15RecommendationBody,
} from "@workspace/api-zod";
import { requireAgencyIdentity, type AgencyIdentity } from "../security/agencyIdentity.js";
import { getTrainingAlertStore, type TrainingAlertStore } from "../lib/training-alert-store.js";
import { PacketError } from "../lib/packet-errors.js";

export type SignInProfile = { email: string | null; name: string | null };
/** Read from Clerk on the server: the primary email only when Clerk marked it
 * verified, and the account's full name. Never taken from the request. */
export async function signInProfile(identityId: string): Promise<SignInProfile> {
  if (!process.env.CLERK_SECRET_KEY) return { email: null, name: null };
  const user = await clerkClient.users.getUser(identityId);
  const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);
  return {
    email: primary?.verification?.status === "verified" ? primary.emailAddress : null,
    name: user.fullName?.trim() || null,
  };
}

export function createTrainingAlertsRouter(
  authenticate: RequestHandler = requireAgencyIdentity,
  resolveStore: () => TrainingAlertStore | null = getTrainingAlertStore,
  resolveProfile: (identityId: string) => Promise<SignInProfile> = signInProfile,
) {
  const router = Router();
  router.use("/v1/alerts", authenticate);
  router.get("/v1/alerts", async (req, res) => {
    const query = ListTrainingAlertsQueryParams.safeParse(req.query);
    if (!query.success) { invalid(res, "INVALID_ALERT_QUERY"); return; }
    const identity = res.locals.agencyIdentity as AgencyIdentity;
    try {
      const store = required(resolveStore());
      const page = await store.list(identity, query.data.state ?? "open");
      // Recording the recipient never blocks reading alerts.
      void resolveProfile(identity.id).then(profile => store.registerRecipient(identity, profile.email)).catch(() => undefined);
      res.json(page);
    } catch (error) { alertError(res, error); }
  });
  router.post("/v1/alerts/nrt-review-request", async (req, res) => {
    const input = CreateNrtReviewRequestBody.safeParse(req.body);
    if (!input.success) { invalid(res, "INVALID_NRT_REVIEW_REQUEST"); return; }
    try { res.json(await required(resolveStore()).requestNrtReview(res.locals.agencyIdentity, input.data)); }
    catch (error) { alertError(res, error); }
  });
  router.put("/v1/alerts/week15", async (req, res) => {
    const input = SaveWeek15RecommendationBody.safeParse(req.body);
    if (!input.success) { invalid(res, "INVALID_WEEK15_RECOMMENDATION"); return; }
    try { res.json(await required(resolveStore()).saveWeek15(res.locals.agencyIdentity, input.data)); }
    catch (error) { alertError(res, error); }
  });
  router.post("/v1/alerts/:id/close", async (req, res) => {
    const id = CloseTrainingAlertParams.shape.id.safeParse(req.params.id);
    const input = CloseTrainingAlertBody.safeParse(req.body);
    if (!id.success || !input.success || !input.data.note.trim()) { invalid(res, "ALERT_CLOSE_NOTE_REQUIRED"); return; }
    try {
      const identity = res.locals.agencyIdentity as AgencyIdentity;
      const store = required(resolveStore());
      const profile = await resolveProfile(identity.id).catch(() => ({ email: null, name: null }));
      res.json(await store.close(identity, id.data, input.data.note, profile.name));
    }
    catch (error) { alertError(res, error); }
  });
  return router;
}
function required(store: TrainingAlertStore | null): TrainingAlertStore {
  if (!store) throw new PacketError(503, "AGENCY_STORAGE_UNAVAILABLE");
  return store;
}
function alertError(res: Response, error: unknown) {
  res.status(error instanceof PacketError ? error.status : 503).json({
    status: "error",
    error_code: error instanceof PacketError ? error.code : "AGENCY_STORAGE_UNAVAILABLE",
    message: "The alert was not saved on the server.",
  });
}
function invalid(res: Response, code: string) {
  res.status(400).json({ status: "error", error_code: code, message: "Check the alert details and try again. No records were changed." });
}
export default createTrainingAlertsRouter();
