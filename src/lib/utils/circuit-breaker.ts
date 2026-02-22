type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownPeriod: number;
  successThreshold: number;
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      cooldownPeriod: 30000, // 30 seconds
      successThreshold: 2,
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.cooldownPeriod) {
        console.log(`Circuit breaker ${this.name}: Transitioning to HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN - cooling down`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        console.log(`Circuit breaker ${this.name}: Transitioning to CLOSED`);
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.failures >= this.config.failureThreshold) {
      console.error(`Circuit breaker ${this.name}: Transitioning to OPEN`);
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Singleton instances for each external API
export const propertyDataCircuit = new CircuitBreaker('PropertyData');
export const landRegistryCircuit = new CircuitBreaker('LandRegistry');
export const epcCircuit = new CircuitBreaker('EPC');
