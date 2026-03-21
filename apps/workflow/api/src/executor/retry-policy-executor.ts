/**
 * Retry policy configuration for step execution.
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs?: number;
}

/**
 * Result from executing with retry policy.
 */
export interface RetryPolicyResult<T> {
  readonly value: T;
  readonly attempts: number;
  readonly totalDurationMs: number;
  readonly lastError?: Error;
}

/**
 * Executes a function with automatic retry on failure.
 *
 * The executor:
 * - Attempts execution up to maxAttempts times
 * - Waits delayMs milliseconds between retries (if specified)
 * - Returns the successful result on first success
 * - Throws the last error after exhausting attempts
 * - Tracks total duration including delays
 *
 * @param fn - Async function to execute
 * @param policy - Retry policy configuration
 * @returns Result with execution value, attempt count, and total duration
 * @throws Last error encountered after maxAttempts
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy
): Promise<RetryPolicyResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const value = await fn();
      const totalDurationMs = Date.now() - startTime;

      return {
        value,
        attempts: attempt,
        totalDurationMs
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If we haven't exhausted retries, wait before next attempt
      if (attempt < policy.maxAttempts && policy.delayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, policy.delayMs));
      }
    }
  }

  // All attempts exhausted
  if (lastError !== undefined) {
    throw new Error(
      `Failed after ${String(policy.maxAttempts)} attempts: ${lastError.message}`
    );
  }

  throw new Error(`Failed after ${String(policy.maxAttempts)} attempts`);
}

/**
 * Creates a retry policy from optional configuration.
 * If no policy is provided, returns a policy with maxAttempts=1 (no retries).
 */
export function createRetryPolicy(
  policy?: { maxRetries?: number; backoffMs?: number }
): RetryPolicy {
  if (policy === undefined) {
    return { maxAttempts: 1 };
  }

  // Convert maxRetries to maxAttempts: maxRetries=2 means 1 initial + 2 retries = 3 attempts
  const maxAttempts = (policy.maxRetries ?? 0) + 1;

  return policy.backoffMs !== undefined
    ? { maxAttempts, delayMs: policy.backoffMs }
    : { maxAttempts };
}
