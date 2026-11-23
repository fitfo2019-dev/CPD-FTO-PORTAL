import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import secureRecordsRouter from "./secureRecords.js";
import auditLogsRouter from "./audit-logs.js";
import resourcesRouter from "./resources.js";
import dispatchRouter from "./dispatch.js";
import phaseExtensionRequestsRouter from "./phase-extension-requests.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(secureRecordsRouter);
router.use(auditLogsRouter);
router.use(resourcesRouter);
router.use(dispatchRouter);
router.use(phaseExtensionRequestsRouter);

export default router;
