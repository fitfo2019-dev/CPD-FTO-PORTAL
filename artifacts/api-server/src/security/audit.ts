import type { Role } from "./authorization";

export type AuditAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "LOGIN" | "FAILED_LOGIN";
export type AuditEvent = {
  userId: string | null;
  role: Role | null;
  action: AuditAction;
  targetRecordId: string;
  deviceInfo: string;
  ipAddress: string;
  requestId: string;
};
type Transaction = {
  query: (sql: string, values: unknown[]) => Promise<unknown>;
};

/** Append-only repository. Pass the SAME transaction used for the business
 * operation, and fail closed if audit insertion fails. No update/delete API. */
export async function appendAudit(tx: Transaction, event: AuditEvent): Promise<void> {
  if (event.action !== "FAILED_LOGIN" && (!event.userId || !event.role)) {
    throw new Error("Verified actor required for audit event.");
  }
  await tx.query(
    `INSERT INTO audit_logs
     (user_id, role, action, target_record_id, device_info, ip_address, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [event.userId, event.role, event.action, event.targetRecordId,
      event.deviceInfo.slice(0, 512), event.ipAddress, event.requestId],
  );
}
