export interface RestartDecision {
  attempt: number;
  delayMs: number;
}

/**
 * Bounds automatic server restarts inside a rolling crash window.
 *
 * Successful starts deliberately do not clear the history: a server that
 * repeatedly starts and crashes is still a crash loop. A user-requested
 * restart can call reset() to begin a fresh recovery attempt.
 */
export class ServerRestartPolicy {
  private crashes: number[] = [];

  constructor(
    private readonly maxRestarts = 5,
    private readonly windowMs = 3 * 60 * 1_000,
    private readonly maxDelayMs = 10_000
  ) {}

  public next(now = Date.now()): RestartDecision | undefined {
    const windowStart = now - this.windowMs;
    this.crashes = this.crashes.filter(timestamp => timestamp >= windowStart);

    if (this.crashes.length >= this.maxRestarts) {
      return undefined;
    }

    this.crashes.push(now);
    const attempt = this.crashes.length;
    return {
      attempt,
      delayMs: Math.min(1_000 * 2 ** (attempt - 1), this.maxDelayMs),
    };
  }

  public reset(): void {
    this.crashes = [];
  }
}
