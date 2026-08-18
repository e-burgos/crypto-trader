import { placeProtectionWithRetry } from './protection-retry';

describe('placeProtectionWithRetry', () => {
  const baseRequest = {
    symbol: 'BTCUSDT',
    quantity: 0.1,
    stopPrice: 63_000,
    stopLimitPrice: 62_900,
    takeProfitPrice: 70_000,
    referencePrice: 65_000,
  };

  function makeExecutor(placeProtectionOrder: jest.Mock) {
    return { placeProtectionOrder } as any;
  }

  it('succeeds on the first attempt without retrying', async () => {
    const result = { orderListId: 'ol-1', stopOrderId: 'so-1', limitOrderId: 'lo-1', placedAt: new Date(), kind: 'OCO' };
    const placeProtectionOrder = jest.fn().mockResolvedValue(result);
    const beforeAttempt = jest.fn().mockResolvedValue(undefined);

    const outcome = await placeProtectionWithRetry({
      executor: makeExecutor(placeProtectionOrder),
      request: baseRequest,
      startingFailureCount: 0,
      clientOrderIdFor: (attempt) => `prot-pos-1-${attempt}`,
      beforeAttempt,
      sleep: jest.fn().mockResolvedValue(undefined),
    });

    expect(outcome).toEqual({ outcome: 'PLACED', result, attempts: 1 });
    expect(placeProtectionOrder).toHaveBeenCalledTimes(1);
    expect(placeProtectionOrder).toHaveBeenCalledWith(
      expect.objectContaining({ ...baseRequest, clientOrderId: 'prot-pos-1-1' }),
    );
    expect(beforeAttempt).toHaveBeenCalledWith(1);
  });

  it('retries a retryable error and succeeds on the second attempt', async () => {
    const result = { orderListId: 'ol-2', stopOrderId: 'so-2', limitOrderId: 'lo-2', placedAt: new Date(), kind: 'OCO' };
    const retryableError = { response: { data: { code: -1021, msg: 'timestamp outside recvWindow' } } };
    const placeProtectionOrder = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(result);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const beforeAttempt = jest.fn().mockResolvedValue(undefined);

    const outcome = await placeProtectionWithRetry({
      executor: makeExecutor(placeProtectionOrder),
      request: baseRequest,
      startingFailureCount: 0,
      clientOrderIdFor: (attempt) => `prot-pos-1-${attempt}`,
      beforeAttempt,
      sleep,
    });

    expect(outcome).toEqual({ outcome: 'PLACED', result, attempts: 2 });
    expect(placeProtectionOrder).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(beforeAttempt).toHaveBeenNthCalledWith(1, 1);
    expect(beforeAttempt).toHaveBeenNthCalledWith(2, 2);
  });

  it('stops immediately on a non-retryable error without further attempts', async () => {
    const definitiveError = { response: { data: { code: -2010, msg: 'Account has insufficient balance' } } };
    const placeProtectionOrder = jest.fn().mockRejectedValue(definitiveError);
    const sleep = jest.fn().mockResolvedValue(undefined);

    const outcome = await placeProtectionWithRetry({
      executor: makeExecutor(placeProtectionOrder),
      request: baseRequest,
      startingFailureCount: 0,
      clientOrderIdFor: (attempt) => `prot-pos-1-${attempt}`,
      beforeAttempt: jest.fn().mockResolvedValue(undefined),
      sleep,
    });

    expect(outcome).toEqual({
      outcome: 'FAILED',
      attempts: 1,
      code: -2010,
      message: expect.any(String),
    });
    expect(placeProtectionOrder).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('exhausts all retryable attempts and reports the last error', async () => {
    const retryableError = { response: { data: { code: -1003, msg: 'Too many requests' } } };
    const placeProtectionOrder = jest.fn().mockRejectedValue(retryableError);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const beforeAttempt = jest.fn().mockResolvedValue(undefined);

    const outcome = await placeProtectionWithRetry({
      executor: makeExecutor(placeProtectionOrder),
      request: baseRequest,
      startingFailureCount: 0,
      clientOrderIdFor: (attempt) => `prot-pos-1-${attempt}`,
      beforeAttempt,
      sleep,
    });

    expect(outcome).toEqual({
      outcome: 'FAILED',
      attempts: 3,
      code: -1003,
      message: expect.any(String),
    });
    expect(placeProtectionOrder).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(beforeAttempt).toHaveBeenNthCalledWith(1, 1);
    expect(beforeAttempt).toHaveBeenNthCalledWith(2, 2);
    expect(beforeAttempt).toHaveBeenNthCalledWith(3, 3);
  });

  it('continues attempt numbering from startingFailureCount for cross-cycle dedupe', async () => {
    const definitiveError = { response: { data: { code: -2010, msg: 'rejected' } } };
    const placeProtectionOrder = jest.fn().mockRejectedValue(definitiveError);
    const clientOrderIdFor = jest.fn((attempt: number) => `prot-pos-1-${attempt}`);

    await placeProtectionWithRetry({
      executor: makeExecutor(placeProtectionOrder),
      request: baseRequest,
      startingFailureCount: 3,
      clientOrderIdFor,
      beforeAttempt: jest.fn().mockResolvedValue(undefined),
      sleep: jest.fn().mockResolvedValue(undefined),
    });

    expect(clientOrderIdFor).toHaveBeenCalledWith(4);
  });
});
