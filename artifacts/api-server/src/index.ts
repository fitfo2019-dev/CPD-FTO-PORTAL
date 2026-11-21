import app from "./app.js";
import { USE_REAL_API } from "./lib/config.js";
import { logger } from "./lib/logger.js";

if (
  process.env.NODE_ENV === "production" &&
  USE_REAL_API &&
  !process.env.REAL_API_KEY?.trim()
) {
  throw new Error(
    "CRITICAL CONFIGURATION ERROR: REAL_API_KEY must be provided when live mode is active in production.",
  );
}

if (
  process.env.NODE_ENV === "production" &&
  USE_REAL_API &&
  !process.env.REAL_API_URL?.trim()
) {
  throw new Error(
    "REAL_API_URL must be configured before enabling the live integration in production.",
  );
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
