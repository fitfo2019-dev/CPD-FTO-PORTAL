import { Router, type IRouter } from "express";
import { USE_REAL_API } from "../lib/config.js";
import { normalizeSecureRecords } from "../lib/secure-records.js";
import {
  fetchRealGovernmentData,
  GovApiError,
} from "../services/govApiIntegration.js";

const router: IRouter = Router();

const MOCK_RECORDS = [
  { id: "GOV-MOCK-101", status: "Pending", updated_at: "2026-11-21" },
  { id: "GOV-MOCK-102", status: "Pending", updated_at: "2026-11-20" },
  { id: "GOV-MOCK-103", status: "Pending", updated_at: "2026-11-19" },
];

router.get("/v1/secure-records", async (req, res): Promise<void> => {
  if (!USE_REAL_API) {
    res.status(200).json(normalizeSecureRecords(MOCK_RECORDS));
    return;
  }

  try {
    const upstreamPayload = await fetchRealGovernmentData();
    res.status(200).json(normalizeSecureRecords(upstreamPayload));
  } catch (error) {
    const statusCode = error instanceof GovApiError ? error.statusCode : 502;
    req.log.error(
      { error_code: "UPSTREAM_SERVICE_FAILURE" },
      "Secure records integration failed.",
    );
    res.status(statusCode).json({
      status: "error",
      error_code: "UPSTREAM_SERVICE_FAILURE",
      message: "The secure records service is temporarily unavailable.",
    });
  }
});

export default router;
