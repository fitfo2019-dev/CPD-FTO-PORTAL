import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const operationalProfilesTable = pgSchema("agency_training").table("operational_profiles", {
  subjectHash: text("subject_hash").primaryKey(),
  assignmentToken: text("assignment_token"),
  cruiserNumber: text("cruiser_number"), // Historical derived value; not fleet authority.
  districtToken: text("district_token"),
  cadUnit: text("cad_unit"),
  company: text("company"),
  side: text("side"),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type InsertOperationalProfile = Omit<typeof operationalProfilesTable.$inferInsert, "updatedAt">;
export type OperationalProfileRow = typeof operationalProfilesTable.$inferSelect;
