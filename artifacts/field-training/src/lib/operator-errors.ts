export class OperatorFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperatorFacingError';
  }
}

/** Only explicitly reviewed messages may pass through to an operator screen. */
export function operatorErrorMessage(error: unknown, fallback: string): string {
  return error instanceof OperatorFacingError ? error.message : fallback;
}

export function reportUnexpectedOperatorError(error: unknown, context: string): void {
  if (!(error instanceof OperatorFacingError)) {
    console.error(context, error);
  }
}

export function operatorErrorToast(
  title: string,
  error: unknown,
  fallback: string,
) {
  reportUnexpectedOperatorError(error, `Unexpected failure: ${title}`);
  return {
    title,
    description: operatorErrorMessage(error, fallback),
    variant: 'destructive' as const,
  };
}
