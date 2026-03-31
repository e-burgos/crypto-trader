import {
  Candle,
  RSIResult,
  MACDResult,
  BollingerBandsResult,
  EMACrossResult,
  VolumeResult,
  SupportResistance,
  IndicatorSnapshot,
} from '@crypto-trader/shared';
import {
  RSISignal,
  MACDCrossover,
  BollingerPosition,
  Trend,
  VolumeSignal,
} from '@crypto-trader/shared';
import {
  RSI_PERIOD,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  MACD_FAST,
  MACD_SLOW,
  MACD_SIGNAL,
  BOLLINGER_PERIOD,
  BOLLINGER_STD_DEV,
} from '@crypto-trader/shared';

// ── Helpers ──────────────────────────────────────────────
function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);

  // SMA for first value
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  result.push(sum / Math.min(period, data.length));

  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number {
  if (data.length < period) return data.reduce((a, b) => a + b, 0) / data.length;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function stdDev(data: number[], period: number): number {
  const slice = data.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, val) => sum + (val - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

// ── RSI ──────────────────────────────────────────────────
export function calculateRSI(
  candles: Candle[],
  period = RSI_PERIOD,
): RSIResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < period + 1) {
    return { value: 50, signal: RSISignal.NEUTRAL };
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);

  let signal: RSISignal;
  if (value >= RSI_OVERBOUGHT) signal = RSISignal.OVERBOUGHT;
  else if (value <= RSI_OVERSOLD) signal = RSISignal.OVERSOLD;
  else signal = RSISignal.NEUTRAL;

  return { value: Math.round(value * 100) / 100, signal };
}

// ── MACD ─────────────────────────────────────────────────
export function calculateMACD(
  candles: Candle[],
  fastPeriod = MACD_FAST,
  slowPeriod = MACD_SLOW,
  signalPeriod = MACD_SIGNAL,
): MACDResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0, crossover: MACDCrossover.NONE };
  }

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  // Align: both EMAs start at different offsets
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }

  const signalLine = ema(macdLine, signalPeriod);

  const macdValue = macdLine[macdLine.length - 1];
  const signalValue = signalLine[signalLine.length - 1];
  const histogram = macdValue - signalValue;

  let crossover: MACDCrossover = MACDCrossover.NONE;
  if (macdLine.length >= 2 && signalLine.length >= 2) {
    const prevMacd = macdLine[macdLine.length - 2];
    const prevSignal = signalLine[signalLine.length - 2];
    if (prevMacd <= prevSignal && macdValue > signalValue) {
      crossover = MACDCrossover.BULLISH;
    } else if (prevMacd >= prevSignal && macdValue < signalValue) {
      crossover = MACDCrossover.BEARISH;
    }
  }

  return {
    macd: Math.round(macdValue * 100) / 100,
    signal: Math.round(signalValue * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    crossover,
  };
}

// ── Bollinger Bands ──────────────────────────────────────
export function calculateBollingerBands(
  candles: Candle[],
  period = BOLLINGER_PERIOD,
  stdDevMultiplier = BOLLINGER_STD_DEV,
): BollingerBandsResult {
  const closes = candles.map((c) => c.close);
  const middle = sma(closes, period);
  const sd = stdDev(closes, period);

  const upper = middle + sd * stdDevMultiplier;
  const lower = middle - sd * stdDevMultiplier;
  const bandwidth = upper - lower;

  const currentPrice = closes[closes.length - 1];
  let position: BollingerPosition;
  if (currentPrice > upper) position = BollingerPosition.ABOVE;
  else if (currentPrice < lower) position = BollingerPosition.BELOW;
  else position = BollingerPosition.INSIDE;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    bandwidth: Math.round(bandwidth * 100) / 100,
    position,
  };
}

// ── EMA Cross ────────────────────────────────────────────
export function calculateEMACross(candles: Candle[]): EMACrossResult {
  const closes = candles.map((c) => c.close);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);

  const e9 = ema9[ema9.length - 1] ?? closes[closes.length - 1];
  const e21 = ema21[ema21.length - 1] ?? closes[closes.length - 1];
  const e50 = ema50[ema50.length - 1] ?? closes[closes.length - 1];
  const e200 = ema200[ema200.length - 1] ?? closes[closes.length - 1];

  let trend: Trend;
  if (e9 > e21 && e21 > e50) trend = Trend.BULLISH;
  else if (e9 < e21 && e21 < e50) trend = Trend.BEARISH;
  else trend = Trend.NEUTRAL;

  return {
    ema9: Math.round(e9 * 100) / 100,
    ema21: Math.round(e21 * 100) / 100,
    ema50: Math.round(e50 * 100) / 100,
    ema200: Math.round(e200 * 100) / 100,
    trend,
  };
}

// ── Volume ───────────────────────────────────────────────
export function calculateVolume(candles: Candle[], period = 20): VolumeResult {
  const volumes = candles.map((c) => c.volume);
  const current = volumes[volumes.length - 1];
  const average = sma(volumes, period);
  const ratio = average > 0 ? current / average : 1;

  let signal: VolumeSignal;
  if (ratio > 1.5) signal = VolumeSignal.HIGH;
  else if (ratio < 0.5) signal = VolumeSignal.LOW;
  else signal = VolumeSignal.NORMAL;

  return {
    current: Math.round(current * 100) / 100,
    average: Math.round(average * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    signal,
  };
}

// ── Support & Resistance ─────────────────────────────────
export function calculateSupportResistance(
  candles: Candle[],
  lookback = 50,
): SupportResistance {
  const slice = candles.slice(-lookback);
  const support: number[] = [];
  const resistance: number[] = [];

  for (let i = 2; i < slice.length - 2; i++) {
    const low = slice[i].low;
    const high = slice[i].high;

    // Local minimum
    if (
      low < slice[i - 1].low &&
      low < slice[i - 2].low &&
      low < slice[i + 1].low &&
      low < slice[i + 2].low
    ) {
      support.push(Math.round(low * 100) / 100);
    }

    // Local maximum
    if (
      high > slice[i - 1].high &&
      high > slice[i - 2].high &&
      high > slice[i + 1].high &&
      high > slice[i + 2].high
    ) {
      resistance.push(Math.round(high * 100) / 100);
    }
  }

  // Keep only most recent N levels
  return {
    support: support.slice(-5),
    resistance: resistance.slice(-5),
  };
}

// ── Full Snapshot ────────────────────────────────────────
export function calculateIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  return {
    rsi: calculateRSI(candles),
    macd: calculateMACD(candles),
    bollingerBands: calculateBollingerBands(candles),
    emaCross: calculateEMACross(candles),
    volume: calculateVolume(candles),
    supportResistance: calculateSupportResistance(candles),
    timestamp: Date.now(),
  };
}
