import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import operationalProfileRouter from "./operational-profile.js";
import authRouter from "./auth.js";
import secureRecordsRouter from "./secureRecords.js";
import auditLogsRouter from "./audit-logs.js";
import resourcesRouter from "./resources.js";
import dispatchRouter from "./dispatch.js";
import phaseExtensionRequestsRouter from "./phase-extension-requests.js";
import trainingPacketsRouter from "./training-packets.js";
import packetReviewRouter from "./packet-review.js";
import { enforcePacketReceiptGate } from "../middlewares/packet-receipt-gate.js";

const router: IRouter = Router();
router.use(enforcePacketReceiptGate);

router.use(healthRouter);
router.use(operationalProfileRouter);
router.use(authRouter);
router.use(secureRecordsRouter);
router.use(auditLogsRouter);
router.use(resourcesRouter);
router.use(dispatchRouter);
router.use(phaseExtensionRequestsRouter);
router.use(trainingPacketsRouter);
router.use(packetReviewRouter);

export default router;
