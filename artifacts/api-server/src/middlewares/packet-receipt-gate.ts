import type { RequestHandler } from "express";
import { resolveAgencyIdentity } from "../security/agencyIdentity.js";
import { getPacketReviewStore } from "../lib/packet-review-store.js";
import { reviewError } from "../routes/packet-review.js";
import { PacketError } from "../lib/packet-errors.js";
import type { AgencyIdentity } from "../security/agencyIdentity.js";
import type { PacketReviewStore } from "../lib/packet-review-store.js";

/** UI navigation is gated separately. This server check prevents bypassing the
 * receipt requirement with a bookmark, another tab, or a direct API request. */
export function createPacketReceiptGate(
  identify:(req:import("express").Request)=>AgencyIdentity|null=resolveAgencyIdentity,
  resolveStore:()=>PacketReviewStore|null=getPacketReviewStore,
):RequestHandler{return async(req,res,next)=>{
  const path=req.path;
  if(path==="/healthz"||path==="/v1/packet-review/context"||path.startsWith("/v1/patrol-view/")||
    (req.method==="POST"&&/^\/v1\/packet-review\/submissions\/[^/]+$/.test(path)&&
      req.body?.action==="acknowledge")){next();return;}
  let identity;
  try{identity=identify(req);}catch{next();return;}
  if(identity?.role!=="FTO_COORDINATOR"){next();return;}
  try{
    const store=resolveStore();
    if(!store) throw new PacketError(503,"AGENCY_STORAGE_UNAVAILABLE");
    if((await store.pending(identity)).count) throw new PacketError(409,"PACKET_ACKNOWLEDGMENT_REQUIRED");
    next();
  }catch(error){reviewError(res,error);}
};}
export const enforcePacketReceiptGate=createPacketReceiptGate();
