import { Router, type IRouter, type Response } from "express";
import { requireClerkAuthentication } from "../security/clerkAuthentication.js";

const router: IRouter = Router();

/** Reads the Division Patrol View address from the private server setting.
 * The address is never stored in source or in the browser bundle. */
export function configuredPatrolViewUrl(
  raw: string | undefined = process.env.PATROL_VIEW_URL,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function privateNoStore(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
}

router.get("/v1/patrol-view/status", requireClerkAuthentication, (_req, res) => {
  privateNoStore(res);
  res.json({ status: "success", data: { enabled: configuredPatrolViewUrl() !== null } });
});

router.get("/v1/patrol-view/open", requireClerkAuthentication, (_req, res) => {
  privateNoStore(res);
  const url = configuredPatrolViewUrl();
  if (!url) {
    res.status(404).json({
      status: "error",
      error_code: "PATROL_VIEW_NOT_CONFIGURED",
      message: "Patrol View is not available.",
    });
    return;
  }
  res.redirect(302, url);
});

export default router;
