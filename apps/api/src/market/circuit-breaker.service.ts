import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
}

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Circuit breaker for data source providers.
 * - CLOSED: normal operation, requests flow through
 * - OPEN: provider is degraded, skip calls, use fallback/null
 * - HALF_OPEN: try one request after recovery timeout
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitEntry>();

  getState(name: string): CircuitState {
    const entry = this.circuits.get(name);
    if (!entry) return 'CLOSED';

    if (entry.state === 'OPEN') {
      // Check if recovery timeout has passed → transition to HALF_OPEN
      if (Date.now() - entry.openedAt >= RECOVERY_TIMEOUT_MS) {
        entry.state = 'HALF_OPEN';
        this.logger.log(`${name}: OPEN → HALF_OPEN (retry window)`);
      }
    }
    return entry.state;
  }

  canExecute(name: string): boolean {
    const state = this.getState(name);
    return state !== 'OPEN';
  }

  recordSuccess(name: string): void {
    const entry = this.circuits.get(name);
    if (!entry) return;

    if (entry.state === 'HALF_OPEN') {
      this.logger.log(`${name}: HALF_OPEN → CLOSED (recovered)`);
    }

    // Reset circuit
    entry.state = 'CLOSED';
    entry.failures = 0;
  }

  recordFailure(name: string): CircuitState {
    let entry = this.circuits.get(name);
    if (!entry) {
      entry = { state: 'CLOSED', failures: 0, lastFailureAt: 0, openedAt: 0 };
      this.circuits.set(name, entry);
    }

    entry.failures += 1;
    entry.lastFailureAt = Date.now();

    if (entry.state === 'HALF_OPEN') {
      // Failed during retry → back to OPEN
      entry.state = 'OPEN';
      entry.openedAt = Date.now();
      this.logger.warn(`${name}: HALF_OPEN → OPEN (retry failed)`);
      return 'OPEN';
    }

    if (entry.failures >= FAILURE_THRESHOLD) {
      entry.state = 'OPEN';
      entry.openedAt = Date.now();
      this.logger.warn(
        `${name}: CLOSED → OPEN (${entry.failures} consecutive failures)`,
      );
      return 'OPEN';
    }

    return entry.state;
  }

  getAll(): Record<string, { state: CircuitState; failures: number }> {
    const result: Record<string, { state: CircuitState; failures: number }> =
      {};
    for (const [name, entry] of this.circuits) {
      // Refresh state (may transition OPEN → HALF_OPEN)
      this.getState(name);
      result[name] = { state: entry.state, failures: entry.failures };
    }
    return result;
  }

  reset(name: string): void {
    this.circuits.delete(name);
    this.logger.log(`${name}: circuit reset`);
  }
}
