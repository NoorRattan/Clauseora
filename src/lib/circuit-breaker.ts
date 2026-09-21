export type CircuitBreakerState = "closed" | "open" | "half_open";

export type CircuitBreakerOptions = {
  failureThreshold: number;
  cooldownMs: number;
};

/**
 * Small in-process circuit breaker for stateless server instances.
 *
 * It stores only provider health counters and timestamps. Request bodies,
 * document text, prompts, and model output never enter this object.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbeInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {
    if (options.failureThreshold < 1 || options.cooldownMs < 1) {
      throw new Error("Circuit breaker limits must be positive.");
    }
  }

  canRequest(now = Date.now()): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (now - this.openedAt < this.options.cooldownMs) return false;
      this.state = "half_open";
    }

    if (this.halfOpenProbeInFlight) return false;
    this.halfOpenProbeInFlight = true;
    return true;
  }

  recordSuccess(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.halfOpenProbeInFlight = false;
  }

  recordFailure(now = Date.now()): void {
    this.halfOpenProbeInFlight = false;

    if (this.state === "half_open") {
      this.open(now);
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.open(now);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  private open(now: number): void {
    this.state = "open";
    this.openedAt = now;
    this.halfOpenProbeInFlight = false;
  }
}
