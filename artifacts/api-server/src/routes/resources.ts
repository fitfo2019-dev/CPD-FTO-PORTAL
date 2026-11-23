import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DownloadResourceFileParams } from "@workspace/api-zod";
import { Router, type IRouter, type Response } from "express";
import {
  createResourceCatalogEnvelope,
  getResourceById,
} from "../lib/resource-catalog.js";
import { requireClerkAuthentication } from "../security/clerkAuthentication.js";

const router: IRouter = Router();

function resourceDirectories(): string[] {
  const configuredDirectory = process.env.RESOURCE_FILES_DIR?.trim();
  return [
    configuredDirectory ? resolve(configuredDirectory) : undefined,
    resolve(process.cwd(), "resources"),
    resolve(process.cwd(), "artifacts/api-server/resources"),
  ].filter((directory): directory is string => Boolean(directory));
}

async function findResourceFile(fileName: string): Promise<string | null> {
  for (const directory of resourceDirectories()) {
    const candidate = join(directory, fileName);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the known runtime layouts without exposing paths.
    }
  }
  return null;
}

function sendResourceError(
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
): void {
  res.status(statusCode).json({
    status: "error",
    error_code: errorCode,
    message,
  });
}

router.get("/v1/resources", requireClerkAuthentication, (_req, res): void => {
  res.setHeader("Cache-Control", "private, no-store");
  res.json(createResourceCatalogEnvelope());
});

router.get(
  "/v1/resources/:resourceId/download",
  requireClerkAuthentication,
  async (req, res): Promise<void> => {
    const params = DownloadResourceFileParams.safeParse(req.params);
    if (!params.success) {
      sendResourceError(
        res,
        404,
        "RESOURCE_NOT_FOUND",
        "The requested resource is unavailable.",
      );
      return;
    }

    const resource = getResourceById(params.data.resourceId);
    if (!resource) {
      sendResourceError(
        res,
        404,
        "RESOURCE_NOT_FOUND",
        "The requested resource is unavailable.",
      );
      return;
    }

    const filePath = await findResourceFile(resource.file_name);
    if (!filePath) {
      req.log.error(
        { resourceId: resource.id },
        "An allowlisted resource file is missing",
      );
      sendResourceError(
        res,
        503,
        "RESOURCE_UNAVAILABLE",
        "The requested resource is temporarily unavailable.",
      );
      return;
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(resource.content_type);
    res.download(filePath, resource.download_name, (error?: Error) => {
      if (!error || res.headersSent) return;
      req.log.error(
        { resourceId: resource.id },
        "An allowlisted resource download failed",
      );
      sendResourceError(
        res,
        503,
        "RESOURCE_UNAVAILABLE",
        "The requested resource is temporarily unavailable.",
      );
    });
  },
);

export default router;
