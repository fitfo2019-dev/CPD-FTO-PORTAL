/**
 * COLUMBUS DIVISION OF POLICE - FIELD TRAINING PROGRAM
 * Single source of truth for phase durations and Limbo policy.
 */

export type PhaseId = 1 | 2 | 3 | 4;
export type LimboPolicy =
  | { type: "full_week" }
  | { type: "workdays"; count: number };

export interface PhaseBounds {
  phaseId: PhaseId;
  phaseName: string;
  durationInWeeks: number;
  limbo: LimboPolicy;
}

export const PHASE_TIMELINE_REGISTRY = [
  { phaseId: 1, phaseName: "Phase I", durationInWeeks: 4, limbo: { type: "full_week" } },
  { phaseId: 2, phaseName: "Phase II", durationInWeeks: 4, limbo: { type: "workdays", count: 2 } },
  { phaseId: 3, phaseName: "Phase III", durationInWeeks: 4, limbo: { type: "workdays", count: 1 } },
  { phaseId: 4, phaseName: "Phase IV", durationInWeeks: 3, limbo: { type: "workdays", count: 1 } },
] as const satisfies readonly PhaseBounds[];

export const PHASE_LENGTH_WEEKS: Record<PhaseId, number> =
  Object.fromEntries(PHASE_TIMELINE_REGISTRY.map(({ phaseId, durationInWeeks }) => [phaseId, durationInWeeks])) as Record<PhaseId, number>;

export const PHASE_PROGRAM_WEEK_START: Record<PhaseId, number> = (() => {
  const starts = {} as Record<PhaseId, number>;
  let programWeek = 1;
  for (const phase of PHASE_TIMELINE_REGISTRY) {
    starts[phase.phaseId] = programWeek;
    programWeek += phase.durationInWeeks;
  }
  return starts;
})();

export const PHASE_LIMBO_FULL_WEEKS: readonly PhaseId[] = PHASE_TIMELINE_REGISTRY
  .filter(({ limbo }) => limbo.type === "full_week")
  .map(({ phaseId }) => phaseId);

export const PHASE_LIMBO_WORKDAYS: Record<PhaseId, number> =
  Object.fromEntries(PHASE_TIMELINE_REGISTRY.map(({ phaseId, limbo }) => [
    phaseId,
    limbo.type === "workdays" ? limbo.count : 0,
  ])) as Record<PhaseId, number>;

export const TOTAL_TRAINING_WEEKS =
  PHASE_TIMELINE_REGISTRY.reduce((sum, phase) => sum + phase.durationInWeeks, 0);
