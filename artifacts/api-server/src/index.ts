import app from "./app.js";
import { USE_REAL_API } from "./lib/config.js";
import { logger } from "./lib/logger.js";

if (process.env.NODE_ENV === "production" && USE_REAL_API) {
  const requiredLiveConfig = [
    "REAL_API_URL",
    "REAL_API_KEY",
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
