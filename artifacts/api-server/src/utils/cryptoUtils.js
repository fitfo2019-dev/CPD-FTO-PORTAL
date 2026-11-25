import { createHmac } from "node:crypto";

const hmacKey = process.env.AUDIT_ID_HMAC_KEY;

if (process.env.NODE_ENV === "production" && !hmacKey?.trim()) {
  throw new Error("AUDIT_ID_HMAC_KEY is required in production.");
}

if (!hmacKey?.trim() || Buffer.byteLength(hmacKey, "utf8") < 32) {
  throw new Error(
    "AUDIT_ID_HMAC_KEY must be configured with at least 32 bytes.",
  );
}

export function hashUserIdentifier(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new TypeError("A non-empty identifier is required for hashing.");
  }

  return createHmac("sha256", hmacKey).update(userId, "utf8").digest("hex");
}
