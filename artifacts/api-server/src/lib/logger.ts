import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Pino writes to stdout by default. Keep production logs stream-based so the
// service manager can capture and rotate them; never configure a file target.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
