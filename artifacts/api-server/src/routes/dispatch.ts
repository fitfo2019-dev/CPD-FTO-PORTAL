import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import { DispatchIncidentLookupBody, DispatchIncidentLookupResponse, DispatchEventIngressBody } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import {
  fetchPatrolViewUnitEvent,
  PatrolViewIntegrationError,
} from "../services/patrolViewIntegration.js";
import {fetchPatrolViewIncident} from "../services/patrolViewIncidentIntegration.js";
import { resolveAgencyIdentity } from "../security/agencyIdentity.js";
import { getOperationalProfileStore } from "../lib/operational-profile-store.js";

const router: IRouter = Router();

async function authorizeUnit(req: Request, unit: string, requireProfile = false) {
  const identity = resolveAgencyIdentity(req);
  if (!identity || identity.role !== "FTO") {
    throw new PatrolViewIntegrationError("PATROLVIEW_UNAVAILABLE", 403, "Verified FTO access required.");
  }
  const store = getOperationalProfileStore();
  if (!store) throw new PatrolViewIntegrationError("PATROLVIEW_NOT_CONFIGURED", 503, "Agency storage unavailable.");
  const profile = await store.read(identity);
  if ((requireProfile && !profile.identity) || (profile.identity &&
    unit.trim().toUpperCase().replace(/\s+/g, " ") !== profile.identity.cadUnit)) {
    throw new PatrolViewIntegrationError("PATROLVIEW_UNAVAILABLE", 409, "The active CAD profile has changed.");
  }
  return { identity, version: profile.version, store };
}
async function assertCurrentUnit(context: Awaited<ReturnType<typeof authorizeUnit>>) {
  if ((await context.store.read(context.identity)).version !== context.version)
    throw new PatrolViewIntegrationError("PATROLVIEW_UNAVAILABLE", 409, "The active CAD profile has changed.");
}

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
) {
  res.set("Cache-Control", "no-store");
  res.status(statusCode).json({ status: "error", error_code: code, message });
}

function authorizeDispatch(req:Request,res:Response):boolean {
  let userId: string | null = null;
  try {
    userId = getAuth(req).userId ?? null;
  } catch {
    // A missing or invalid Clerk session never authorizes dispatch data access.
  }
  if (!userId) {
    sendError(res, 401, "AUTHENTICATION_REQUIRED", "Sign-in is required.");
    return false;
  }

  const authorizedUserIds = (process.env.PATROLVIEW_ALLOWED_CLERK_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (authorizedUserIds.length === 0) {
    sendError(
      res,
      503,
      "DISPATCH_AUTHORIZATION_NOT_CONFIGURED",
      "Dispatch access is not configured for this agency.",
    );
    return false;
  }
  if (!authorizedUserIds.includes(userId)) {
    sendError(res, 403, "DISPATCH_ACCESS_DENIED", "Dispatch access is not authorized.");
    return false;
  }
  return true;
}

router.post("/v1/dispatch/incident-lookup",async(req,res):Promise<void>=>{
  if(!authorizeDispatch(req,res))return;
  const input=DispatchIncidentLookupBody.strict().safeParse(req.body);
  if(!input.success){
    sendError(res,400,'INVALID_INCIDENT_LOOKUP','Enter a valid incident number and unit / cruiser assignment.');
    return;
  }
  try{
    const context=await authorizeUnit(req,input.data.unitNumber);
    const data=await fetchPatrolViewIncident(input.data.incidentNumber,input.data.unitNumber);
    await assertCurrentUnit(context);
    const response=DispatchIncidentLookupResponse.safeParse({
      status:'success',metadata:{total_records:data.length},data,
    });
    if(!response.success)throw new PatrolViewIntegrationError('PATROLVIEW_INVALID_RESPONSE',502,'Invalid incident response.');
    res.set('Cache-Control','no-store');
    res.json(response.data);
  }catch(error){
    logger.warn({errorCode:error instanceof PatrolViewIntegrationError?error.code:'PATROLVIEW_UNAVAILABLE'},'Dispatch incident lookup unavailable');
    sendError(res,error instanceof PatrolViewIntegrationError?error.statusCode:502,
      'DISPATCH_PREFILL_UNAVAILABLE','Dispatch details are unavailable. Enter or correct the run details manually.');
  }
});

router.post("/v1/dispatch/event-ingress", async (req, res): Promise<void> => {
  if(!authorizeDispatch(req,res))return;
  const input=DispatchEventIngressBody.strict().safeParse(req.body);
  if (!input.success) {
    sendError(res, 400, "INVALID_DISPATCH_EVENT_ID", "A valid dispatch event identifier is required.");
    return;
  }

  try {
    const context=await authorizeUnit(req,input.data.cadUnit,true);
    const data = await fetchPatrolViewUnitEvent(input.data.eventId,input.data.cadUnit);
    await assertCurrentUnit(context);
    res.set("Cache-Control", "no-store");
    const totalRecords = Object.keys(data).length > 0 ? 1 : 0;
    res.json({
      status: "success",
      metadata: { total_records: totalRecords },
      data: totalRecords ? [data] : [],
    });
  } catch (error) {
    if (error instanceof PatrolViewIntegrationError) {
      logger.warn({ errorCode: error.code }, "Dispatch event prefill request failed");
      sendError(
        res,
        error.statusCode,
        "DISPATCH_PREFILL_UNAVAILABLE",
        "Dispatch details are unavailable. Enter or correct the run details manually.",
      );
      return;
    }
    logger.error("Dispatch event prefill request failed unexpectedly");
    sendError(
      res,
      500,
      "DISPATCH_PREFILL_UNAVAILABLE",
      "Dispatch details are unavailable. Enter or correct the run details manually.",
    );
  }
});

export default router;
