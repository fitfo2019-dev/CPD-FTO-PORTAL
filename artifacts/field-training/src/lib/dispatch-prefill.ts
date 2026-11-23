export type DispatchPrefill = {
  eventIngressAt?: string;
  incidentNumber?: string;
  location?: string;
  dispatchedCode?: string;
};

export type DispatchPrefillDraft = {
  runDateTimeText: string;
  runTimeText: string;
  incidentNumber: string;
  runLocation: string;
  dispatchedCode: string;
};

export function applyDispatchPrefillValue(
  current: string,
  initial: string,
  incoming: string | undefined,
): string {
  return incoming !== undefined && current === initial ? incoming : current;
}

export function mapDispatchPrefillResponse(value: unknown): DispatchPrefill | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return;
  const root = value as Record<string, unknown>;
  if (root.status !== "success" || typeof root.data !== "object" || root.data === null || Array.isArray(root.data)) return;
  const data = root.data as Record<string, unknown>;
  const result: DispatchPrefill = {};
  if (typeof data.eventIngressAt === "string" && Number.isFinite(Date.parse(data.eventIngressAt))) {
    result.eventIngressAt = data.eventIngressAt;
  }
  if (typeof data.incidentNumber === "string") result.incidentNumber = data.incidentNumber;
  if (typeof data.location === "string") result.location = data.location;
  if (typeof data.dispatchedCode === "string" && /^\d{1,3}[A-Za-z]?$/.test(data.dispatchedCode)) {
    result.dispatchedCode = data.dispatchedCode.toUpperCase();
  }
  return result;
}

/** Apply an incoming default only where the user has not edited that field. */
export function applyDispatchPrefill(
  current: DispatchPrefillDraft,
  initial: DispatchPrefillDraft,
  prefill: DispatchPrefill,
  eventDateTimeText?: string,
): DispatchPrefillDraft {
  return {
    runDateTimeText: applyDispatchPrefillValue(
      current.runDateTimeText,
      initial.runDateTimeText,
      eventDateTimeText,
    ),
    runTimeText: applyDispatchPrefillValue(
      current.runTimeText,
      initial.runTimeText,
      eventDateTimeText?.split(" ")[1],
    ),
    incidentNumber: applyDispatchPrefillValue(
      current.incidentNumber,
      initial.incidentNumber,
      prefill.incidentNumber,
    ),
    runLocation: applyDispatchPrefillValue(
      current.runLocation,
      initial.runLocation,
      prefill.location,
    ),
    dispatchedCode: applyDispatchPrefillValue(
      current.dispatchedCode,
      initial.dispatchedCode,
      prefill.dispatchedCode,
    ),
  };
}
