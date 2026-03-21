export function hasPendingCheckoutChanges(statusOutput: string): boolean {
  return statusOutput.trim().length > 0;
}
