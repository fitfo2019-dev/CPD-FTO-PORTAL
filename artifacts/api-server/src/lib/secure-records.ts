import { ListSecureRecordsResponse } from "@workspace/api-zod";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new Error("Upstream records payload is invalid.");
}

/** Validate upstream or mock data and always return the project envelope. */
export function normalizeSecureRecords(payload: unknown) {
  const records = getRecords(payload);
  const parsed = ListSecureRecordsResponse.parse({
    status: "success",
    metadata: { total_records: records.length },
    data: records,
  });

  // The generated validator uses Date for OpenAPI `format: date`; serialize
  // back to the contract's date-only representation.
  return {
    ...parsed,
    data: parsed.data.map((record) => ({
      ...record,
      updated_at: record.updated_at.toISOString().slice(0, 10),
    })),
  };
}
