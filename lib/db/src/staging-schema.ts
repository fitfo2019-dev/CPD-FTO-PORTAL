/**
 * Isolated synthetic staging only. Deliberately NOT exported by schema/index.ts:
 * normal application schema pushes must not install developer-only tables.
 * No operational records, automatic draft import, or production activation.
 */
import { boolean, date, integer, jsonb, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const syntheticTraining = pgSchema("synthetic_training");
export const stagingMembers = syntheticTraining.table("members", {
  id: uuid("id").primaryKey(),
  subjectHash: text("subject_hash").notNull().unique(),
  role: text("role", { enum: ["PO", "FTO", "FTO_COORDINATOR", "TEST_ADMIN"] }).notNull(),
  active: boolean("active").notNull().default(false),
  agencyVerified: boolean("agency_verified").notNull().default(false),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
});
export const stagingClasses = syntheticTraining.table("classes", {
  id: uuid("id").primaryKey(),
  coordinatorId: uuid("coordinator_id").notNull().references(() => stagingMembers.id),
  active: boolean("active").notNull().default(false),
  phaseActive: boolean("phase_active").notNull().default(false),
});
export const stagingAssignments = syntheticTraining.table("assignments", {
  id: uuid("id").primaryKey(),
  classId: uuid("class_id").notNull().references(() => stagingClasses.id),
  poId: uuid("po_id").notNull().references(() => stagingMembers.id),
  ftoId: uuid("fto_id").notNull().references(() => stagingMembers.id),
  phase: integer("phase").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  active: boolean("active").notNull().default(false),
});
export const stagingRecords = syntheticTraining.table("records", {
  id: uuid("id").primaryKey(),
  assignmentId: uuid("assignment_id").notNull().references(() => stagingAssignments.id),
  recordDate: date("record_date").notNull(),
  narrative: text("narrative").notNull(),
  status: text("status", { enum: ["draft", "submitted"] }).notNull(),
  version: integer("version").notNull().default(1),
  acknowledgedVersion: integer("acknowledged_version"),
}, table => [unique().on(table.assignmentId, table.recordDate)]);
export const stagingAuditEvents = syntheticTraining.table("audit_events", {
  id: uuid("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  actorHash: text("actor_hash").notNull(),
  role: text("role").notNull(),
  clientIpHash: text("client_ip_hash").notNull(),
  requestId: text("request_id").notNull(),
  action: text("action").notNull(),
  recordId: uuid("record_id"),
  version: integer("version"),
});
export const stagingRecordVersions = syntheticTraining.table("record_versions", {
  recordId: uuid("record_id").notNull().references(() => stagingRecords.id),
  version: integer("version").notNull(),
  narrative: text("narrative").notNull(),
  status: text("status", { enum: ["draft", "submitted"] }).notNull(),
}, table => [unique().on(table.recordId, table.version)]);
export const stagingReceipts = syntheticTraining.table("receipts", {
  actorHash: text("actor_hash").notNull(),
  operationId: uuid("operation_id").notNull(),
  digest: text("digest").notNull(),
  response: jsonb("response").notNull(),
}, table => [unique().on(table.actorHash, table.operationId)]);
