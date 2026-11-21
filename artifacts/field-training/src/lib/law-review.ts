import type { Role, TrainingAssignment } from './model';

/**
 * Limits the local review UI to assignments associated with the current account.
 * This is a display rule only; a shared service must enforce authorization.
 */
export function assignmentsForLawReview(
  role: Role,
  assignments: TrainingAssignment[],
  signedInEmail?: string,
  signedInFtoBadge?: string,
): TrainingAssignment[] {
  if (role === 'fto_coordinator') return assignments;
  if (role === 'fto' && signedInFtoBadge) {
    const badge = signedInFtoBadge.trim().toLocaleLowerCase();
    return assignments.filter((assignment) => assignment.ftoBadge.trim().toLocaleLowerCase() === badge);
  }
  if (role === 'po' && signedInEmail) {
    const email = signedInEmail.trim().toLocaleLowerCase();
    return assignments.filter((assignment) => assignment.recruitEmail?.trim().toLocaleLowerCase() === email);
  }
  return [];
}

export function lawReviewId(assignmentId: string, sourceId: string) {
  return `law-review:${encodeURIComponent(assignmentId)}:${encodeURIComponent(sourceId)}`;
}
