import { Router, type IRouter } from "express";
import { ListAuditLogsResponse } from "@workspace/api-zod";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";

const router: IRouter = Router();

const MOCK_AUDIT_LOGS = [
  {
    timestamp: "2026-11-21T08:26:14.102Z",
    request_id: "req-9c8b3f21-4401",
    actor: {
      user_id_hash: hashUserIdentifier("mock-admin-auditor"),
      assigned_role: "ADMIN",
    },
    network: {
      client_ip_hash: hashUserIdentifier("198.51.100.42"),
      user_agent: "Chrome/131 on Windows",
    },
    event: {
      http_method: "POST",
      endpoint: "/api/v1/secure-records/export",
      payload_bytes: 142,
      status_code: 200,
      success: true,
      disposition: "SUCCESS",
    },
  },
  {
    timestamp: "2026-11-21T08:23:10.418Z",
    request_id: "req-7a0d2b11-4402",
    actor: "ANONYMOUS",
    network: {
      client_ip_hash: hashUserIdentifier("203.0.113.24"),
      user_agent: "Firefox/132",
    },
    event: {
      http_method: "GET",
      endpoint: "/api/v1/secure-records",
      payload_bytes: 0,
      status_code: 401,
      success: false,
      disposition: "FAILURE",
    },
  },
  {
    timestamp: "2026-11-21T08:19:52.006Z",
    request_id: "req-6a7f8910-4403",
    actor: {
      user_id_hash: hashUserIdentifier("mock-admin-auditor"),
      assigned_role: "ADMIN",
    },
    network: {
      client_ip_hash: hashUserIdentifier("192.0.2.19"),
      user_agent: "Edge/131",
    },
    event: {
      http_method: "POST",
      endpoint: "/api/v1/secure-records/export",
      payload_bytes: 86,
      status_code: 500,
      success: false,
      disposition: "FAILURE",
      error_message: "Simulated server-side error for dashboard preview.",
    },
  },
];

router.get("/v1/audit-logs", (_req, res): void => {
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({
      status: "error",
      error_code: "ROUTE_NOT_FOUND",
      message: "This endpoint is disabled in production environments.",
    });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  const response = ListAuditLogsResponse.parse({
    status: "success",
    metadata: {
      total_records: MOCK_AUDIT_LOGS.length,
      environment: "MOCK_DEVELOPMENT",
    },
    data: MOCK_AUDIT_LOGS,
  });

  res.status(200).json(response);
});

export default router;
