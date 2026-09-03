import {
  buildCoordinationRedisOptions,
  resolveReactiveCoordinationDriver,
} from './reactive-coordination.module';
import { DisabledReactiveCoordination } from './disabled-reactive-coordination.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

describe('coordination Redis client options', () => {
  it('disables the offline queue so a command on a dead client is rejected instead of queued forever', () => {
    expect(buildCoordinationRedisOptions().enableOfflineQueue).toBe(false);
  });

  it('bounds every command and every connection attempt with the coordination timeout', () => {
    const options = buildCoordinationRedisOptions();

    expect(options.commandTimeout).toBe(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.coordinationCommandTimeoutMs,
    );
    expect(options.connectTimeout).toBe(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.coordinationCommandTimeoutMs,
    );
    expect(options.maxRetriesPerRequest).toBe(1);
  });

  it('keeps reconnecting: it never installs a retry strategy that gives up', () => {
    expect(buildCoordinationRedisOptions().retryStrategy).toBeUndefined();
  });

  it('reads the timeouts from the thresholds it is given', () => {
    const options = buildCoordinationRedisOptions({
      ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      coordinationCommandTimeoutMs: 750,
    });

    expect(options.commandTimeout).toBe(750);
  });
});

describe('resolveReactiveCoordinationDriver', () => {
  const driver = process.env.REACTIVE_COORDINATION_DRIVER;

  afterEach(() => {
    if (driver === undefined) delete process.env.REACTIVE_COORDINATION_DRIVER;
    else process.env.REACTIVE_COORDINATION_DRIVER = driver;
  });

  it('falls back to the disabled driver when the env does not ask for redis', () => {
    process.env.REACTIVE_COORDINATION_DRIVER = 'off';

    const coordination = resolveReactiveCoordinationDriver();

    expect(coordination).toBeInstanceOf(DisabledReactiveCoordination);
    expect(coordination.isHealthy()).toBe(false);
    expect(coordination.isEnabled?.()).toBe(false);
  });
});
