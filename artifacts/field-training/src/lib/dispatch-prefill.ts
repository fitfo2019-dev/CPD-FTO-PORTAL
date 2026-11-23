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
  const metadata = root.metadata;
  if (
    root.status !== "success"
    || typeof metadata !== "object"
    || metadata === null
    || Array.isArray(metadata)
    || typeof (metadata as Record<string, unknown>).total_records !== "number"
    || !Array.isArray(root.data)
    || root.data.length > 1
    || (metadata as Record<string, unknown>).total_records !== root.data.length
  ) return;
  if (root.data.length === 0) return {};
  const data = root.data[0];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  const result: DispatchPrefill = {};
  if (record.eventIngressAt !== undefined) {
    if (typeof record.eventIngressAt !== "string" || !Number.isFinite(Date.parse(record.eventIngressAt))) return;
    result.eventIngressAt = record.eventIngressAt;
  }
  if (record.incidentNumber !== undefined) {
    if (typeof record.incidentNumber !== "string" || record.incidentNumber.length > 120) return;
    result.incidentNumber = record.incidentNumber;
  }
  if (record.location !== undefined) {
    if (typeof record.location !== "string" || record.location.length > 200) return;
    result.location = record.location;
  }
  if (record.dispatchedCode !== undefined) {
    if (typeof record.dispatchedCode !== "string" || !/^\d{1,3}[A-Za-z]?$/.test(record.dispatchedCode)) return;
    result.dispatchedCode = record.dispatchedCode.toUpperCase();
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
