import app from "./app.js";
import { USE_REAL_API } from "./lib/config.js";
import { logger } from "./lib/logger.js";

if (process.env.NODE_ENV === "production" && USE_REAL_API) {
  const requiredLiveConfig = [
    "GOV_API_SECURE_RECORDS_URL",
    "GOV_API_ALLOWED_HOSTS",
    "GOV_API_AUDIENCE",
    "GOV_API_AUTHORIZED_PARTIES",
    "CLERK_SECRET_KEY",
    "AUDIT_ID_HMAC_KEY",
  ];
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

app.listen(PORT, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port: PORT }, "Server listening");
});
