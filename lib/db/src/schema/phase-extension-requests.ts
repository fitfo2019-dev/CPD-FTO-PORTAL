import { date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const phaseExtensionRequestsTable = pgTable(
  "phase_extension_requests",
  {
    id: text("id").primaryKey(),
    requesterUserId: text("requester_user_id").notNull(),
    className: text("class_name").notNull(),
    recruitName: text("recruit_name").notNull(),
    recruitBadge: text("recruit_badge").notNull(),
    phase: integer("phase").notNull(),
    phaseStartDate: date("phase_start_date", { mode: "string" }).notNull(),
    requestingFtoName: text("requesting_fto_name").notNull(),
    requestingFtoBadge: text("requesting_fto_badge").notNull(),
    extensionType: text("extension_type", {
      enum: ["training_weeks", "limbo_period"],
    }).notNull(),
    requestedWeeks: integer("requested_weeks").notNull(),
    justification: text("justification").notNull(),
    status: text("status", { enum: ["pending", "approved", "denied"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id"),
  },
  table => [
    index("phase_extension_requests_requester_status_idx").on(
      table.requesterUserId,
      table.status,
      table.createdAt,
    ),
    index("phase_extension_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export type PhaseExtensionRequestRow =
  typeof phaseExtensionRequestsTable.$inferSelect;
