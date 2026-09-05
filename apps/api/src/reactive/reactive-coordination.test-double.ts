import type { ReactiveCoordinationPort } from './reactive-coordination.port';

export interface FakeCoordination extends ReactiveCoordinationPort {
  setHealthy(value: boolean): void;
  ownerOf(key: string): string | undefined;
}

export function createSharedFakeCoordination(): FakeCoordination {
  const store = new Map<string, string>();
  const json = new Map<string, unknown>();
  let healthy = true;
  return {
    setHealthy(value: boolean) {
      healthy = value;
    },
    ownerOf(key: string) {
      return store.get(key);
    },
    isHealthy: () => healthy,
    tryAcquire: jest.fn(async (key: string, holderId: string) => {
      if (!healthy) return false;
      if (store.has(key)) return false;
      store.set(key, holderId);
      return true;
    }),
    renew: jest.fn(async (key: string, holderId: string) => {
      if (!healthy) return false;
      return store.get(key) === holderId;
    }),
    release: jest.fn(async (key: string, holderId: string) => {
      if (store.get(key) === holderId) store.delete(key);
    }),
    tryConsumeToken: jest.fn(async () => false),
    setJson: jest.fn(async (key: string, value: unknown) => {
      if (!healthy) return;
      json.set(key, value);
    }),
    getJson: jest.fn(async (key: string) =>
      healthy ? (json.get(key) ?? null) : null,
    ) as ReactiveCoordinationPort['getJson'],
  };
}
