import { date, index, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const phaseExtensionRequestsTable = pgSchema("agency_training").table(
  "phase_extension_requests",
  {
    id: text("id").primaryKey(),
    assignmentId: uuid("assignment_id").notNull(),
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
    denialExplanation: text("denial_explanation"),
  },
  table => [
    index("phase_extension_requests_requester_created_idx").on(
      table.requesterUserId,
      table.createdAt,
    ),
    index("phase_extension_requests_assignment_status_created_idx").on(
      table.assignmentId,
      table.status,
      table.createdAt,
    ),
  ],
);

export type PhaseExtensionRequestRow =
  typeof phaseExtensionRequestsTable.$inferSelect;
