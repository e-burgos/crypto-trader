import { Candle } from '@crypto-trader/shared';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateEMACross,
  calculateVolume,
  calculateSupportResistance,
  calculateIndicatorSnapshot,
} from './indicators';

/**
 * Generate synthetic candles for testing.
 * Pattern: prices trend upward with some variation.
 */
function generateCandles(count: number, startPrice = 100, trend = 0.5): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.3) * 2 + trend) * (1 + Math.random() * 0.5);
    price += change;
    price = Math.max(price, 1); // Ensure positive

    const open = price;
    const high = price + Math.random() * 3;
    const low = price - Math.random() * 3;
    const close = price + (Math.random() - 0.4) * 2;
    const volume = 50 + Math.random() * 100;

    candles.push({
      openTime: 1672531200000 + i * 3600000,
      open,
      high: Math.max(open, close, high),
      low: Math.min(open, close, low),
      close: Math.max(close, 1),
      volume,
      closeTime: 1672531200000 + (i + 1) * 3600000 - 1,
    });
  }
  return candles;
}

describe('Technical Indicators', () => {
  const candles = generateCandles(200);

  describe('RSI', () => {
    it('should return value between 0 and 100', () => {
      const result = calculateRSI(candles);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should return a signal', () => {
      const result = calculateRSI(candles);
      expect(['OVERBOUGHT', 'NEUTRAL', 'OVERSOLD']).toContain(result.signal);
    });

    it('should return NEUTRAL for insufficient data', () => {
      const short = candles.slice(0, 5);
      const result = calculateRSI(short);
      expect(result.signal).toBe('NEUTRAL');
    });

    it('should detect overbought on extreme uptrend', () => {
      // Create a strongly rising series
      const rising = generateCandles(50, 100, 5);
      const result = calculateRSI(rising);
      // Should tend toward overbought territory
      expect(result.value).toBeGreaterThan(50);
    });
  });

  describe('MACD', () => {
    it('should return macd, signal, and histogram', () => {
      const result = calculateMACD(candles);
      expect(typeof result.macd).toBe('number');
      expect(typeof result.signal).toBe('number');
      expect(typeof result.histogram).toBe('number');
      expect(['BULLISH', 'BEARISH', 'NONE']).toContain(result.crossover);
    });

    it('should handle insufficient data', () => {
      const short = candles.slice(0, 10);
      const result = calculateMACD(short);
      expect(result.crossover).toBe('NONE');
    });
  });

  describe('Bollinger Bands', () => {
    it('should return upper > middle > lower', () => {
      const result = calculateBollingerBands(candles);
      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.middle).toBeGreaterThan(result.lower);
    });

    it('should return a position signal', () => {
      const result = calculateBollingerBands(candles);
      expect(['ABOVE', 'INSIDE', 'BELOW']).toContain(result.position);
    });

    it('should have positive bandwidth', () => {
      const result = calculateBollingerBands(candles);
      expect(result.bandwidth).toBeGreaterThan(0);
    });
  });

  describe('EMA Cross', () => {
    it('should return all four EMAs', () => {
      const result = calculateEMACross(candles);
      expect(typeof result.ema9).toBe('number');
      expect(typeof result.ema21).toBe('number');
      expect(typeof result.ema50).toBe('number');
      expect(typeof result.ema200).toBe('number');
    });

    it('should return a trend signal', () => {
      const result = calculateEMACross(candles);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result.trend);
    });
  });

  describe('Volume', () => {
    it('should return current, average, and ratio', () => {
      const result = calculateVolume(candles);
      expect(result.current).toBeGreaterThan(0);
      expect(result.average).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThan(0);
    });

    it('should return a volume signal', () => {
      const result = calculateVolume(candles);
      expect(['HIGH', 'NORMAL', 'LOW']).toContain(result.signal);
    });
  });

  describe('Support & Resistance', () => {
    it('should return arrays of support and resistance levels', () => {
      const result = calculateSupportResistance(candles);
      expect(Array.isArray(result.support)).toBe(true);
      expect(Array.isArray(result.resistance)).toBe(true);
    });

    it('should return at most 5 levels each', () => {
      const result = calculateSupportResistance(candles);
      expect(result.support.length).toBeLessThanOrEqual(5);
      expect(result.resistance.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Full Snapshot', () => {
    it('should return a complete indicator snapshot', () => {
      const snapshot = calculateIndicatorSnapshot(candles);
      expect(snapshot.rsi).toBeDefined();
      expect(snapshot.macd).toBeDefined();
      expect(snapshot.bollingerBands).toBeDefined();
      expect(snapshot.emaCross).toBeDefined();
      expect(snapshot.volume).toBeDefined();
      expect(snapshot.supportResistance).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });
  });
});
