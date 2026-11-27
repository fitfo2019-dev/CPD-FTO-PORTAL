import { logger, processLogger } from "./lib/logger.js";
import { assertNoTestAuthorityInProduction } from "./security/testAuthority.js";

const absolutePathPattern =
  /(?:file:\/\/)?\/(?:home|root|Users|private|tmp|var|nix|usr|opt|etc|srv|run|mnt|workspace|workspaces|app|build|repo|project)(?:\/[^\s:()[\]]*)*/g;
const windowsPathPattern = /\b[A-Za-z]:\\(?:[^\s:()[\]]+\\)*[^\s:()[\]]*/g;

function sanitizeStack(value: string): string {
  return value
    .replace(absolutePathPattern, "[REDACTED_PATH]")
    .replace(windowsPathPattern, "[REDACTED_PATH]")
    .slice(0, 12_000);
}

function getSafeErrorDetails(reason: unknown): {
  error_type: string;
  stack?: string;
} {
  if (!(reason instanceof Error)) {
    return { error_type: "NonErrorRejection" };
  }

  const errorType = reason.name
    .replace(absolutePathPattern, "[REDACTED_PATH]")
    .replace(windowsPathPattern, "[REDACTED_PATH]")
    .slice(0, 100);
  const stackLines = reason.stack?.split(/\r?\n/).slice(1) ?? [];
  const stack = sanitizeStack(stackLines.join("\n"));

  return {
    error_type: errorType || "Error",
    ...(stack ? { stack } : {}),
  };
}

function terminateAfterFatalError(event: string, reason: unknown): never {
  try {
    processLogger.fatal(
      {
        event,
        ...getSafeErrorDetails(reason),
      },
      "Process exiting after an unhandled failure",
    );
  } finally {
    process.exit(1);
  }
}

process.on("uncaughtException", (error) =>
  terminateAfterFatalError("uncaught_exception", error),
);
process.on("unhandledRejection", (reason) =>
  terminateAfterFatalError("unhandled_rejection", reason),
);

async function startServer(): Promise<void> {
  assertNoTestAuthorityInProduction();
  if (process.env.AGENCY_PACKET_SYNC_ENABLED === "true") {
    const required = ["AGENCY_DATABASE_URL", "AGENCY_ROLE_CLAIM_PATH",
      "AGENCY_VERIFIED_CLAIM_PATH", "AGENCY_BADGE_CLAIM_PATH", "AUDIT_ID_HMAC_KEY",
      "AGENCY_PACKET_TEST_ENV_APPROVED"];
    if (required.some(key => !process.env[key]?.trim())) {
      throw new Error("Agency packet sync requires an approved isolated test environment, database, verified identity claim mappings and audit configuration.");
    }
    if (process.env.AGENCY_PACKET_TEST_ENV_APPROVED !== "true" || process.env.NODE_ENV === "production") {
      throw new Error("Agency packet sync is disabled outside an explicitly approved non-production test environment.");
    }
  }
  // Load application modules after installing process handlers so startup
  // validation failures are recorded through the sanitized crash logger too.
  const [{ default: app }, { USE_REAL_API }] = await Promise.all([
    import("./app.js"),
    import("./lib/config.js"),
  ]);

  if (process.env.NODE_ENV === "production" && USE_REAL_API) {
    const requiredLiveConfig = ["REAL_API_URL", "REAL_API_KEY"];
    const missing = requiredLiveConfig.filter(
      (key) => !process.env[key]?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `Live API mode requires department-approved configuration: ${missing.join(", ")}.`,
      );
    }
  }

  const rawPort = process.env.PORT || 3000;
  const PORT = Number(rawPort);

  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const server = app.listen(PORT, "0.0.0.0");
  server.once("error", (error) =>
    terminateAfterFatalError("server_listen_error", error),
  );
  server.once("listening", () => {
    logger.info({ port: PORT }, "Server listening");
  });
  await startAlertEmailSender();
}

async function startAlertEmailSender() {
  const [{ alertEmailMode, runTestEmailPass }, { getAgencyDatabasePool }] = await Promise.all([
    import("./lib/alert-email-sender.js"),
    import("./lib/agency-database.js"),
  ]);
  const { mode, unknown } = alertEmailMode();
  if (unknown) logger.warn({ alert_email_mode: unknown }, "Unknown ALERT_EMAIL_MODE; alert email stays off");
  if (mode !== "test") return;
  const pool = getAgencyDatabasePool();
  if (!pool) return;
  const portalUrl = process.env.ALERT_EMAIL_PORTAL_URL?.trim() || undefined;
  let running = false;
  const pass = () => { if (running) return Promise.resolve(); running = true; return runTestEmailPass(pool, message =>
    logger.info({ alert_email: "test", outbox_id: message.outboxId, notice: message.notice,
      recipient_hash: message.recipientHash, subject: message.subject, text: message.text },
      "Alert email rendered in test mode; not sent"), { portalUrl })
    .catch(() => logger.warn({ alert_email: "test" }, "Alert email test pass failed"))
    .finally(() => { running = false; }); };
  logger.info({ alert_email: "test" }, "Alert email test sender running; no mail is sent");
  void pass();
  setInterval(() => void pass(), 60_000).unref();
}

void startServer().catch((error: unknown) =>
  terminateAfterFatalError("startup_failure", error),
);
