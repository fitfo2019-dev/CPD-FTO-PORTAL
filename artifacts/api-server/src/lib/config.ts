export function isRealApiEnabled(): boolean {
  const rawUseRealApi = process.env.USE_REAL_API?.trim().toLowerCase();
  if (
    rawUseRealApi !== undefined &&
    rawUseRealApi !== "true" &&
    rawUseRealApi !== "false"
  ) {
    throw new Error('USE_REAL_API must be either "true" or "false".');
  }
  return rawUseRealApi === "true";
}

/** Startup snapshot used for production configuration checks. */
export const USE_REAL_API = isRealApiEnabled();
