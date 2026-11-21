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

// Process-failure records must remain one JSON line even in development and
// must be flushed before the process exits. Use a synchronous stdout target.
export const processLogger = pino(
  {
    level: "fatal",
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.destination({ fd: 1, sync: true }),
);
