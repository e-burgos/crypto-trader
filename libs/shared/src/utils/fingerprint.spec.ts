import { fingerprint } from './fingerprint';

describe('fingerprint', () => {
  it('produces the same hash for objects with keys in different order', () => {
    const a = fingerprint({ b: 2, a: 1 });
    const b = fingerprint({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('produces the same hash for nested objects with keys in different order', () => {
    const a = fingerprint({ outer: { z: 1, y: 2 }, id: 'x' });
    const b = fingerprint({ id: 'x', outer: { y: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('produces a different hash when a value changes', () => {
    const a = fingerprint({ headline: 'BTC ETF approved', sentiment: 'POSITIVE' });
    const b = fingerprint({ headline: 'BTC ETF approved', sentiment: 'NEGATIVE' });
    expect(a).not.toBe(b);
  });

  it('produces a different hash when an array item is added', () => {
    const a = fingerprint([{ id: '1' }]);
    const b = fingerprint([{ id: '1' }, { id: '2' }]);
    expect(a).not.toBe(b);
  });

  it('is stable across repeated calls with the same value', () => {
    const value = { a: [1, 2, 3], b: { c: 'x' } };
    expect(fingerprint(value)).toBe(fingerprint(value));
  });

  it('distinguishes array order from object key order', () => {
    const a = fingerprint([1, 2, 3]);
    const b = fingerprint([3, 2, 1]);
    expect(a).not.toBe(b);
  });

  it('hashes null and undefined-heavy structures without throwing', () => {
    expect(() => fingerprint({ a: null, b: undefined })).not.toThrow();
  });
});
