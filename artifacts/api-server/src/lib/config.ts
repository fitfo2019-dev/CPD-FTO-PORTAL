const rawUseRealApi = process.env.USE_REAL_API?.trim().toLowerCase();

if (
  rawUseRealApi !== undefined &&
  rawUseRealApi !== "true" &&
  rawUseRealApi !== "false"
) {
  throw new Error('USE_REAL_API must be either "true" or "false".');
}

/** Live upstream access is disabled unless explicitly enabled. */
export const USE_REAL_API = rawUseRealApi === "true";
