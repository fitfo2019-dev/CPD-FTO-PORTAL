import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const result = HealthCheckResponse.parse({
    status: "success",
    metadata: {},
    data: [{ status: "ok" }],
  });
  res.json(result);
});

export default router;
