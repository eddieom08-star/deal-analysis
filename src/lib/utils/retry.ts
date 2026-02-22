export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: (error: Error) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors = isRetryableError,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxAttempts || !retryableErrors(lastError)) {
        throw lastError;
      }

      console.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network/timeout errors
  if (message.includes('timeout') || message.includes('network') || message.includes('fetch')) {
    return true;
  }

  // HTTP status codes
  if (message.includes('429')) return true; // Rate limit
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true; // Server errors

  // Non-retryable
  if (message.includes('400') || message.includes('401') || message.includes('403') || message.includes('404')) {
    return false; // Client errors
  }

  return false; // Default: don't retry unknown errors
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
