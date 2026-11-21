import { z } from 'zod';
import {
  CATEGORIES,
  PRIMARY_RUN_FORMS,
  RATINGS,
  type Report,
  type SubstationOrientationRecord,
  type WeeklyPacketAcknowledgement,
  type WeeklyPerformanceLog,
} from './model.js';

const phaseSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const ratingSchema = z.enum([...RATINGS, '']);
const reportShiftSchema = z.enum(['A-Co', 'B-Co', 'C-Co', 'DMW', 'EMW', 'Day', 'Swing', 'Night']);
const booleanRecordSchema = z.record(z.string(), z.boolean());

const signatureSchema = z.object({
  name: z.string(),
  badge: z.string(),
  at: z.string(),
  method: z.enum(['demo', 'account', 'acrobat']).optional(),
  accountId: z.string().optional(),
  contentSha256: z.string().optional(),
}).passthrough();

const ratingEntrySchema = z.object({
  rating: ratingSchema,
  nrtWithUnacceptable: z.boolean(),
  nrtPriorUnacceptableIds: z.array(z.string()).optional(),
  nrtPriorDocumentationReviewed: z.boolean(),
  nrtTrainingReviewed: z.boolean(),
  nrtCoordinatorsNotified: z.boolean(),
  nrtFtoSergeantNotified: z.boolean(),
  justification: z.string(),
  nrtCorrectiveActions: z.string().optional(),
  nrtOfficeReviewStatus: z.enum(['not_submitted', 'submitted', 'responded']).optional(),
  nrtOfficeAction: z.enum(['accepted_meeting', 'call_office', 'more_information']).optional(),
  nrtOfficeResponse: z.string().optional(),
  nrtOfficeSubmittedAt: z.string().optional(),
  nrtOfficeRespondedAt: z.string().optional(),
}).passthrough();

const ratingsSchema = z.record(z.string(), ratingEntrySchema).superRefine((ratings, context) => {
  for (const category of CATEGORIES) {
    if (!ratings[category]) {
      context.addIssue({
        code: 'custom',
        path: [category],
        message: 'A rating entry is required for every performance category.',
      });
    }
  }
});

const trainingRunSchema = z.object({
  id: z.string(),
  incidentNumber: z.string().optional(),
  location: z.string().optional(),
  endedAt: z.string().optional(),
  occurredAt: z.string(),
  runKind: z.string().refine(value => PRIMARY_RUN_FORMS.some(form => form.key === value)),
  isDispatched: z.boolean(),
  trafficMode: z.enum(['none', 'motor_vehicle', 'pedestrian', 'bicycle', 'other']),
  dispatchedCode: z.string().optional(),
  situationFoundCode: z.string().optional(),
  clearanceCode: z.enum(['', '1V', '2V', '3V', '4V']).optional(),
  arrestMade: z.boolean(),
  transportedAfterArrest: z.boolean(),
  arrestProcessRequired: z.boolean().optional(),
  activityFlags: booleanRecordSchema.optional(),
  oviProcessed: z.boolean(),
  narrativeAdditionRequired: z.boolean(),
  formStatus: z.enum(['not_started', 'in_progress', 'complete']),
  checklist: booleanRecordSchema,
  directiveReviews: z.record(z.string(), z.unknown()).optional(),
  checklistReviewedAt: z.string().optional(),
  narrative: z.string(),
}).passthrough();

const dutyRecordSchema = z.object({
  dutyStatus: z.enum(['on_duty', 'training', 'sick', 'off_duty', 'other']),
  checklist: booleanRecordSchema,
  notApplicable: booleanRecordSchema.optional(),
  notes: z.string(),
  reviewedAt: z.string().optional(),
}).passthrough();

const reportSchema = z.object({
  id: z.string(),
  date: z.string(),
  shift: reportShiftSchema,
  phase: phaseSchema,
  zone: z.string(),
  precinct: z.string(),
  cruiserDistrict: z.string(),
  ftoAssignment: z.string().optional(),
  className: z.string().optional(),
  phaseWeek: z.number().int().optional(),
  limboDay: z.boolean().optional(),
  ftoWeek: z.number().int().optional(),
  recruitName: z.string(),
  recruitBadge: z.string(),
  ftoName: z.string(),
  ftoBadge: z.string(),
  substituteCoverage: z.object({
    assignmentId: z.string(),
    regularFtoName: z.string(),
    regularFtoBadge: z.string(),
    phaseStartDate: z.string(),
  }).optional(),
  activity: z.record(z.string(), z.number().int().nonnegative()),
  activityCountsIncludeRuns: z.boolean().optional(),
  legacyActivity: z.record(z.string(), z.unknown()).optional(),
  runs: z.array(trainingRunSchema),
  reportingForDuty: dutyRecordSchema,
  ratings: ratingsSchema,
  ratingsReviewedAt: z.string().optional(),
  legacyEvaluation: z.record(z.string(), z.unknown()).optional(),
  legacyGeography: z.object({
    previousPrecinctText: z.string().optional(),
    previousAreaText: z.string().optional(),
  }).optional(),
  narrative: z.string(),
  remedial: z.string(),
  recruitComments: z.string(),
  status: z.enum(['draft', 'fto_signed', 'recruit_signed', 'locked']),
  signatures: z.object({
    fto: signatureSchema.optional(),
    recruit: signatureSchema.optional(),
    sergeant: signatureSchema.optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const acknowledgementSchema = z.object({
  id: z.string(),
  weekStart: z.string(),
  weekEnd: z.string(),
  weekNumber: z.number().int(),
  phase: phaseSchema,
  recruitName: z.string(),
  recruitBadge: z.string(),
  recruitAssignment: z.string(),
  ftoName: z.string(),
  ftoBadge: z.string(),
  ftoAssignment: z.string(),
  recruitComments: z.string(),
  ftoComments: z.string(),
  officeComments: z.string(),
  signatures: z.object({
    recruit: signatureSchema.optional(),
    fto: signatureSchema.optional(),
    ftoOffice: signatureSchema.optional(),
    legacySergeant: signatureSchema.optional(),
  }),
  status: z.enum(['draft', 'recruit_signed', 'fto_signed', 'office_signed']),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const weeklyLogSchema = z.object({
  id: z.string(),
  weekStart: z.string(),
  weekEnd: z.string(),
  weekNumber: z.number().int(),
  phase: phaseSchema,
  phaseWeek: z.number().int().optional(),
  ftoWeek: z.number().int().optional(),
  className: z.string(),
  recruitName: z.string(),
  recruitBadge: z.string(),
  ftoName: z.string(),
  ftoBadge: z.string(),
  entries: z.array(z.object({
    id: z.string(),
    kind: z.enum(['strength', 'corrective']),
    category: z.string().refine(value => CATEGORIES.includes(value as (typeof CATEGORIES)[number])),
    totalTime: z.string(),
    narrative: z.string(),
    sourceReportIds: z.array(z.string()),
    sourceReferences: z.array(z.string()).optional(),
    sourceReferenceReviewed: z.boolean().optional(),
    autoGeneratedFromUa: z.boolean().optional(),
  }).passthrough()),
  updatedAt: z.string(),
}).passthrough();

const orientationSchema = z.object({
  id: z.string(),
  className: z.string(),
  recruitName: z.string(),
  recruitBadge: z.string(),
  ftoName: z.string(),
  ftoBadge: z.string(),
  phase: phaseSchema.optional(),
  phaseStartDate: z.string(),
  dateTime: z.string(),
  substation: z.string(),
  checklist: booleanRecordSchema,
  checklistReviewedAt: z.string().optional(),
  directivesReview: z.string(),
  narrative: z.string(),
  updatedAt: z.string(),
}).passthrough();

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error('Saved records do not match the expected spreadsheet export structure.');
  }
  return result.data;
}

export function validateReportsForExport(value: unknown): Report[] {
  return parseOrThrow(z.array(reportSchema), value) as Report[];
}

export function validateClassWorkbookInputs(value: unknown): {
  reports: Report[];
  acknowledgements: WeeklyPacketAcknowledgement[];
  weeklyLogs: WeeklyPerformanceLog[];
  orientations: SubstationOrientationRecord[];
} {
  const parsed = parseOrThrow(z.object({
    reports: z.array(reportSchema).min(1),
    acknowledgements: z.array(acknowledgementSchema),
    weeklyLogs: z.array(weeklyLogSchema),
    orientations: z.array(orientationSchema),
  }), value);
  return parsed as unknown as {
    reports: Report[];
    acknowledgements: WeeklyPacketAcknowledgement[];
    weeklyLogs: WeeklyPerformanceLog[];
    orientations: SubstationOrientationRecord[];
  };
}
