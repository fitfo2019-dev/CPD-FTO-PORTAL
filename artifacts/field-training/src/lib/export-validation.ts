import { z } from 'zod';
import { isTacticalCallSign, PatrolAssignmentMetadataSchema } from './cpd-geography.js';
import {
  CATEGORIES,
  DAILY_ACTIVITY_FIELDS,
  PRIMARY_RUN_FORMS,
  PHASES,
  RATINGS,
  SUPPLEMENTAL_RUN_FORMS,
  type Report,
  type Phase,
  type SubstationOrientationRecord,
  type WeeklyPacketAcknowledgement,
  type WeeklyPerformanceLog,
} from './model.js';

const phaseSchema = z.custom<Phase>(value=>Number.isInteger(value)&&PHASES.includes(value as Phase),'Phase must be configured in the phase registry');
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

const categorySchema = z.enum(CATEGORIES);
const activityKeySchema = z.enum(DAILY_ACTIVITY_FIELDS.map(field => field.key));
const ratingsSchema = z.record(categorySchema, ratingEntrySchema);
const directiveReviewSchema = z.object({
  divisionDirectives: z.boolean(),
  selectedDirectives: z.array(z.string()),
  directiveDetails: z.string(),
  ohioRevisedCode: z.boolean(),
  selectedOrcReferences: z.array(z.string()).optional(),
  columbusCityCode: z.boolean(),
  selectedColumbusCodeReferences: z.array(z.string()).optional(),
  other: z.boolean(),
  otherDetails: z.string(),
});

const trainingRunSchema = z.object({
  clearanceRulesVersion: z.literal(1).optional(),
  charges: z.array(z.object({id:z.string().min(1),description:z.string().min(1)})).optional(),
  generatedDocuments: z.array(z.object({
    id:z.string(),kind:z.enum(['U-10.100','Probable Cause Affidavit','Criminal Complaint Form']),
    chargeId:z.string().optional(),description:z.string().optional(),
  })).optional(),
  id: z.string(),
  incidentNumber: z.string().optional(),
  unitNumber: z.string().max(40).optional(),
  location: z.string().optional(),
  locationCity: z.string().max(80).optional(),
  locationState: z.string().regex(/^[A-Z]{2}$/).optional(),
  locationZip: z.string().regex(/^\d{5}(?:-\d{4})?$/).optional(),
  incidentZone: z.string().max(40).optional(),
  incidentCruiserDistrict: z.string().max(40).optional(),
  transportDestination: z.string().max(200).optional(),
  transportDestinationType: z.enum(['Jail','HQ','Clerks']).optional(),
  endedAt: z.string().optional(),
  dispatchedAt: z.string().optional(),
  occurredAt: z.string(),
  runKind: z.enum(PRIMARY_RUN_FORMS.map(form => form.key)),
  isDispatched: z.boolean(),
  trafficMode: z.enum(['none', 'motor_vehicle', 'pedestrian', 'bicycle', 'other']),
  dispatchedCode: z.string().optional(),
  situationFoundCode: z.string().optional(),
  clearanceCode: z.enum(['', '1V', '2V', '3V', '4V']).optional(),
  arrestMade: z.boolean(),
  transportedAfterArrest: z.boolean(),
  arrestProcessRequired: z.boolean().optional(),
  activityFlags: z.partialRecord(activityKeySchema, z.boolean()).optional(),
  oviProcessed: z.boolean(),
  narrativeAdditionRequired: z.boolean(),
  formStatus: z.enum(['not_started', 'in_progress', 'complete']),
  checklist: booleanRecordSchema,
  directiveReviews: z.partialRecord(
    z.enum([...PRIMARY_RUN_FORMS.map(form => form.key), ...SUPPLEMENTAL_RUN_FORMS.map(form => form.key)]),
    directiveReviewSchema,
  ).optional(),
  checklistReviewedAt: z.string().optional(),
  narrative: z.string(),
}).passthrough();

const dutyRecordSchema = z.object({
  cruiserId: z.string().max(80).optional(),
  shotgunTraining: z.enum(['Y','N']).optional(),
  dutyStatus: z.enum(['on_duty', 'training', 'sick', 'off_duty', 'other']),
  checklist: booleanRecordSchema,
  notApplicable: booleanRecordSchema.optional(),
  notes: z.string(),
  reviewedAt: z.string().optional(),
}).passthrough();

const reportSchema = z.object({
  deficiencyAutomationEnabled:z.boolean().optional(),
  deficiencyOverrides:z.record(z.string(),categorySchema).optional(),
  deficiencyNarratives:z.record(z.string(),z.string()).optional(),
  deficiencyPriorRatings:z.partialRecord(categorySchema,ratingEntrySchema).optional(),
  deficiencyGeneratedText:z.partialRecord(categorySchema,z.string()).optional(),
  deficiencySafetyLocks:z.array(categorySchema).optional(),
  notApplicableCategories:z.array(categorySchema).optional(),
  checklistDeficiencies:z.array(z.object({
    id:z.string(),runId:z.string().optional(),category:categorySchema,narrative:z.string(),
    tasks:z.array(z.object({id:z.string(),label:z.string(),reference:z.string().optional()})),
    reviewed:z.boolean().optional(),
  })).optional(),
  id: z.string(),
  date: z.string(),
  shiftStartTime:z.string().refine(value=>value===''||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),'Shift start time must use 24-hour HH:MM format').optional(),
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
  activity: z.record(activityKeySchema, z.number().int().nonnegative()),
  activityCountsIncludeRuns: z.boolean().optional(),
  legacyActivity: z.record(z.string(), z.unknown()).optional(),
  runs: z.array(trainingRunSchema),
  reportingForDuty: dutyRecordSchema,
  ratings: ratingsSchema,
  ratingsReviewedAt: z.string().optional(),
  legacyEvaluation: z.object({
    source: z.string(),
    ratings: z.record(z.string(), z.object({ rating: z.string(), justification: z.string() })),
  }).optional(),
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
}).passthrough().superRefine((value,context)=>{
  if(!isTacticalCallSign(value.ftoAssignment)) return;
  const metadata=PatrolAssignmentMetadataSchema.safeParse(value);
  if(!metadata.success) metadata.error.issues.forEach(issue=>context.addIssue({...issue,code:'custom'}));
});

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
    category: categorySchema,
    totalTime: z.string(),
    narrative: z.string(),
    sourceReportIds: z.array(z.string()),
    sourceReferences: z.array(z.string()).optional(),
    sourceReferenceReviewed: z.boolean().optional(),
    autoGeneratedFromUa: z.boolean().optional(),
    autoSourceNarrative:z.string().optional(),
    autoSourceGroup:z.string().optional(),
    sourceEvidenceActive:z.boolean().optional(),
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
  return parseOrThrow(z.array(reportSchema), value);
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
  return parsed;
}
