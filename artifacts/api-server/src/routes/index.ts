import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import secureRecordsRouter from "./secureRecords.js";
import auditLogsRouter from "./audit-logs.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(secureRecordsRouter);
router.use(auditLogsRouter);

export default router;
