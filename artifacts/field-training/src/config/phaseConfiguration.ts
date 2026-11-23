/**
 * Authoritative phase duration and Limbo configuration for Field Training.
 *
 * Phase IV is intentionally fixed at three weeks. Do not change phase duration
 * or week boundaries without the required program approval and validation.
 *
 * Agency IT maintenance without Replit:
 * 1. Open this file in a standard local text editor.
 * 2. After program approval, change the `durationInWeeks` value for the approved phase.
 *    For the deferred Phase IV extension, change only Phase IV from 3 to 4.
 * 3. Program-week starts recalculate automatically from phase order and
 *    durations; do not edit a second start-value table.
 * 4. From the repository root, run `pnpm typecheck`, then `pnpm run build`.
 * 5. Review phase setup ranges, Limbo boundaries, and export tests before release.
 *    Update phase-configuration.test.ts only to match an approved schedule.
 * These instructions require no Replit-only commands or packages.
 */

export type PhaseId = 1 | 2 | 3 | 4;

export const PHASE_TIMELINE_REGISTRY = [
  { phase: 1, durationInWeeks: 4, limboFullWeek: true, limboWorkdays: 0 },
  { phase: 2, durationInWeeks: 4, limboFullWeek: false, limboWorkdays: 2 },
  { phase: 3, durationInWeeks: 4, limboFullWeek: false, limboWorkdays: 1 },
  { phase: 4, durationInWeeks: 3, limboFullWeek: false, limboWorkdays: 1 },
] as const satisfies readonly {
  phase: PhaseId;
  durationInWeeks: number;
  limboFullWeek: boolean;
  limboWorkdays: number;
}[];

export const PHASE_LENGTH_WEEKS: Record<PhaseId, number> =
  Object.fromEntries(PHASE_TIMELINE_REGISTRY.map(({ phase, durationInWeeks }) => [phase, durationInWeeks])) as Record<PhaseId, number>;

export const PHASE_PROGRAM_WEEK_START: Record<PhaseId, number> = (() => {
  const starts = {} as Record<PhaseId, number>;
  let programWeek = 1;
  for (const configuration of PHASE_TIMELINE_REGISTRY) {
    starts[configuration.phase] = programWeek;
    programWeek += configuration.durationInWeeks;
  }
  return starts;
})();

export const PHASE_LIMBO_FULL_WEEKS: readonly PhaseId[] = PHASE_TIMELINE_REGISTRY
  .filter(({ limboFullWeek }) => limboFullWeek)
  .map(({ phase }) => phase);

export const PHASE_LIMBO_WORKDAYS: Record<PhaseId, number> =
  Object.fromEntries(PHASE_TIMELINE_REGISTRY.map(({ phase, limboWorkdays }) => [phase, limboWorkdays])) as Record<PhaseId, number>;

export const TOTAL_TRAINING_WEEKS = PHASE_TIMELINE_REGISTRY.reduce((sum, phase) => sum + phase.durationInWeeks, 0);
