import { Router, type RequestHandler } from "express";
import { ActOnPacketSubmissionBody, UpdatePacketCoordinatorBody,GetPacketSubmissionParams,ListPacketSubmissionsQueryParams } from "@workspace/api-zod";
import { requireAgencyIdentity, type AgencyIdentity } from "../security/agencyIdentity.js";
import { getPacketReviewStore, type PacketReviewStore } from "../lib/packet-review-store.js";
import { PacketError } from "../lib/packet-errors.js";

const idSchema=GetPacketSubmissionParams.shape.id;
export function createPacketReviewRouter(
  authenticate:RequestHandler=requireAgencyIdentity,
  resolveStore:()=>PacketReviewStore|null=getPacketReviewStore,
) {
  const router=Router();
  router.use("/v1/packet-review",authenticate);
  router.get("/v1/packet-review/context",async(_req,res)=>{
    const identity=res.locals.agencyIdentity as AgencyIdentity;
    try{
      const store=resolveStore();
      if(!store){res.json({available:false,account_id:identity.id,role:identity.role,
        coordinators:[],assignments:[],pending_count:0,pending:null});return;}
      res.json(await store.context(identity));
    }catch{
      // Keep the verified role available even when storage fails. A Coordinator
      // must see a blocking unavailable gate, not a false empty notification list.
      res.json({available:false,account_id:identity.id,role:identity.role,
        coordinators:[],assignments:[],pending_count:0,pending:null});
    }
  });
  router.put("/v1/packet-review/coordinator",async(req,res)=>{
    const input=UpdatePacketCoordinatorBody.safeParse(req.body);
    if(!input.success){invalidReview(res,"INVALID_COORDINATOR_ASSIGNMENT");return;}
    try{
      const store=resolveStore();if(!store)throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.assign(res.locals.agencyIdentity,input.data));
    }catch(error){reviewError(res,error);}
  });
  router.get("/v1/packet-review/submissions",async(req,res)=>{
    const page=ListPacketSubmissionsQueryParams.safeParse(req.query);
    if(!page.success||(page.data.offset??0)>1000000){invalidReview(res,"INVALID_PAGE");return;}
    try{
      const store=resolveStore();if(!store)throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.list(res.locals.agencyIdentity,page.data.offset??0));
    }catch(error){reviewError(res,error);}
  });
  router.get("/v1/packet-review/submissions/:id",async(req,res)=>{
    const id=idSchema.safeParse(req.params.id);
    if(!id.success){invalidReview(res,"INVALID_SUBMISSION_ID");return;}
    try{
      const store=resolveStore();if(!store)throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.detail(res.locals.agencyIdentity,id.data));
    }catch(error){reviewError(res,error);}
  });
  router.post("/v1/packet-review/submissions/:id",async(req,res)=>{
    const id=idSchema.safeParse(req.params.id),input=ActOnPacketSubmissionBody.safeParse(req.body);
    if(!id.success||!input.success){invalidReview(res,"INVALID_REVIEW_ACTION");return;}
    try{
      const store=resolveStore();if(!store)throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
      res.json(await store.act(res.locals.agencyIdentity,id.data,input.data));
    }catch(error){reviewError(res,error);}
  });
  return router;
}
export function reviewError(res:import("express").Response,error:unknown) {
  res.status(error instanceof PacketError?error.status:503).json({
    status:"error",
    error_code:error instanceof PacketError?error.code:"AGENCY_STORAGE_UNAVAILABLE",
    message:"The packet-review operation was not completed. Local drafts were not removed.",
  });
}
function invalidReview(res:import("express").Response,code:string) {
  res.status(400).json({status:"error",error_code:code,message:"Check the packet-review input and try again. No records were changed."});
}
export default createPacketReviewRouter();
