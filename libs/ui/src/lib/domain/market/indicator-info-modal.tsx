import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export type IndicatorKey =
  | 'price'
  | 'signalReasons'
  | 'opportunity'
  | 'chart'
  | 'rsi'
  | 'macd'
  | 'ema'
  | 'bollinger'
  | 'volume'
  | 'supportResistance';

// ── Mini SVG Charts ───────────────────────────────────────────────────────────────

function PriceChart() {
  const pricePoints =
    '10,70 40,60 70,52 100,44 120,30 140,38 160,34 190,28 220,22 260,16';
  const changePoints =
    '10,70 40,60 70,52 100,44 120,30 140,38 160,34 190,28 220,22 260,16';
  return (
    <svg
      viewBox="0 0 280 90"
      className="w-full h-24"
      role="img"
      aria-label="Price chart example"
    >
      {/* Grid lines */}
      {[20, 40, 60].map((y) => (
        <line
          key={y}
          x1="10"
          y1={y}
          x2="270"
          y2={y}
          stroke="#1e293b"
          strokeWidth="1"
        />
      ))}
      {/* Area fill */}
      <defs>
        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pricePoints} 260,80 10,80`} fill="url(#priceGrad)" />
      {/* Price line */}
      <polyline
        points={changePoints}
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 24h change markers */}
      <circle
        cx="10"
        cy="70"
        r="4"
        fill="#64748b"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle
        cx="260"
        cy="16"
        r="5"
        fill="#10b981"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <text x="210" y="12" fill="#10b981" fontSize="9" fontWeight="600">
        +3.46% → HOY
      </text>
      {/* Labels */}
      <text x="10" y="87" fill="#64748b" fontSize="9">
        24h atrás
      </text>
      <text x="238" y="87" fill="#94a3b8" fontSize="9">
        Ahora
      </text>
      {/* Signal pill */}
      <rect
        x="100"
        y="5"
        width="80"
        height="16"
        rx="8"
        fill="#f59e0b"
        opacity="0.15"
      />
      <text
        x="140"
        y="17"
        fill="#f59e0b"
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
      >
        NEUTRAL
      </text>
    </svg>
  );
}

function RsiChart() {
  return (
    <svg
      viewBox="0 0 280 80"
      className="w-full h-20"
      role="img"
      aria-label="RSI scale chart"
    >
      {/* Track */}
      <rect x="10" y="30" width="260" height="12" rx="6" fill="#1e293b" />
      {/* Oversold zone 0-30 */}
      <rect
        x="10"
        y="30"
        width="78"
        height="12"
        rx="6"
        fill="#10b981"
        opacity="0.4"
      />
      {/* Neutral zone 30-70 */}
      <rect
        x="88"
        y="30"
        width="104"
        height="12"
        fill="#f59e0b"
        opacity="0.25"
      />
      {/* Overbought zone 70-100 */}
      <rect
        x="192"
        y="30"
        width="78"
        height="12"
        rx="6"
        fill="#ef4444"
        opacity="0.4"
      />
      {/* Markers */}
      <line
        x1="88"
        y1="22"
        x2="88"
        y2="50"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />
      <line
        x1="192"
        y1="22"
        x2="192"
        y2="50"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeDasharray="3,2"
      />
      {/* Labels */}
      <text x="10" y="18" fill="#64748b" fontSize="10">
        0
      </text>
      <text x="83" y="18" fill="#10b981" fontSize="10">
        30
      </text>
      <text x="188" y="18" fill="#ef4444" fontSize="10">
        70
      </text>
      <text x="267" y="18" fill="#64748b" fontSize="10">
        100
      </text>
      {/* Zone labels */}
      <text x="30" y="65" fill="#10b981" fontSize="9" fontWeight="600">
        OVERSOLD
      </text>
      <text x="120" y="65" fill="#f59e0b" fontSize="9" fontWeight="600">
        NEUTRAL
      </text>
      <text x="208" y="65" fill="#ef4444" fontSize="9" fontWeight="600">
        OVERBOUGHT
      </text>
      {/* Needle example at ~45 */}
      <circle
        cx="127"
        cy="36"
        r="7"
        fill="#a855f7"
        stroke="#fff"
        strokeWidth="1.5"
        opacity="0.9"
      />
    </svg>
  );
}

function MacdChart() {
  // Static illustration of MACD lines crossing
  const macdPoints =
    '20,60 50,50 80,40 110,30 140,35 170,45 200,55 230,60 260,65';
  const signalPoints =
    '20,55 50,52 80,48 110,42 140,42 170,48 200,55 230,58 260,62';
  const histData = [
    { x: 20, h: 5, pos: true },
    { x: 50, h: -2, pos: false },
    { x: 80, h: -8, pos: false },
    { x: 110, h: -12, pos: false },
    { x: 140, h: -7, pos: false },
    { x: 170, h: 3, pos: true },
    { x: 200, h: 0, pos: true },
    { x: 230, h: -2, pos: false },
    { x: 260, h: -3, pos: false },
  ];
  return (
    <svg
      viewBox="0 0 280 90"
      className="w-full h-24"
      role="img"
      aria-label="MACD chart"
    >
      {/* Zero line */}
      <line
        x1="10"
        y1="55"
        x2="270"
        y2="55"
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="4,3"
      />
      {/* Histogram bars */}
      {histData.map((d) => (
        <rect
          key={d.x}
          x={d.x - 6}
          y={d.pos ? 55 - Math.abs(d.h) * 2 : 55}
          width="12"
          height={Math.abs(d.h) * 2}
          fill={d.pos ? '#10b981' : '#ef4444'}
          opacity="0.5"
          rx="1"
        />
      ))}
      {/* MACD line */}
      <polyline
        points={macdPoints}
        fill="none"
        stroke="#818cf8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Signal line */}
      <polyline
        points={signalPoints}
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5,3"
      />
      {/* Bullish cross marker */}
      <circle cx="170" cy="45" r="5" fill="#10b981" opacity="0.9" />
      <text x="175" y="40" fill="#10b981" fontSize="9">
        Cross ↑
      </text>
      {/* Legend */}
      <line x1="10" y1="82" x2="24" y2="82" stroke="#818cf8" strokeWidth="2" />
      <text x="27" y="85" fill="#94a3b8" fontSize="9">
        MACD
      </text>
      <line
        x1="70"
        y1="82"
        x2="84"
        y2="82"
        stroke="#f97316"
        strokeWidth="2"
        strokeDasharray="4,2"
      />
      <text x="87" y="85" fill="#94a3b8" fontSize="9">
        Signal
      </text>
      <rect
        x="130"
        y="76"
        width="10"
        height="10"
        fill="#10b981"
        opacity="0.5"
      />
      <text x="143" y="85" fill="#94a3b8" fontSize="9">
        Hist +
      </text>
      <rect
        x="185"
        y="76"
        width="10"
        height="10"
        fill="#ef4444"
        opacity="0.5"
      />
      <text x="198" y="85" fill="#94a3b8" fontSize="9">
        Hist -
      </text>
    </svg>
  );
}

function EmaChart() {
  return (
    <svg
      viewBox="0 0 280 90"
      className="w-full h-24"
      role="img"
      aria-label="EMA crossover chart"
    >
      {/* Price line */}
      <polyline
        points="10,70 40,65 70,55 100,48 130,40 160,35 190,32 220,30 260,28"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="4,3"
      />
      {/* EMA 9 (fast) */}
      <polyline
        points="10,72 40,64 70,53 100,44 130,38 160,33 190,30 220,29 260,27"
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* EMA 21 (slow) */}
      <polyline
        points="10,68 40,67 70,63 100,56 130,50 160,43 190,37 220,33 260,29"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Cross point */}
      <circle
        cx="155"
        cy="38"
        r="6"
        fill="#a855f7"
        stroke="#fff"
        strokeWidth="1.5"
        opacity="0.9"
      />
      <text x="162" y="34" fill="#a855f7" fontSize="9" fontWeight="600">
        Cruce ↑
      </text>
      {/* Highlight area after cross */}
      <polygon
        points="155,38 155,75 260,75 260,27"
        fill="#10b981"
        opacity="0.06"
      />
      {/* Legend */}
      <line
        x1="10"
        y1="83"
        x2="24"
        y2="83"
        stroke="#10b981"
        strokeWidth="2.5"
      />
      <text x="27" y="86" fill="#94a3b8" fontSize="9">
        EMA 9 (rápida)
      </text>
      <line
        x1="120"
        y1="83"
        x2="134"
        y2="83"
        stroke="#f97316"
        strokeWidth="2.5"
      />
      <text x="137" y="86" fill="#94a3b8" fontSize="9">
        EMA 21 (lenta)
      </text>
    </svg>
  );
}

function BollingerChart() {
  return (
    <svg
      viewBox="0 0 280 100"
      className="w-full h-24"
      role="img"
      aria-label="Bollinger Bands chart"
    >
      {/* Upper band */}
      <polyline
        points="10,20 60,18 110,15 160,22 210,18 260,14"
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.5"
        strokeDasharray="4,3"
      />
      {/* Lower band */}
      <polyline
        points="10,75 60,78 110,80 160,72 210,76 260,82"
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.5"
        strokeDasharray="4,3"
      />
      {/* Band fill */}
      <path
        d="M10,20 Q60,18 110,15 Q160,22 210,18 Q260,14 260,14 L260,82 Q210,76 160,72 Q110,80 60,78 Q10,75 10,75 Z"
        fill="#818cf8"
        opacity="0.07"
      />
      {/* Middle band (SMA) */}
      <polyline
        points="10,48 60,48 110,47 160,47 210,47 260,48"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
      {/* Price line */}
      <polyline
        points="10,50 40,45 70,38 90,22 110,30 140,48 170,60 200,75 230,65 260,50"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Touch upper */}
      <circle cx="90" cy="22" r="5" fill="#ef4444" opacity="0.9" />
      <text x="95" y="18" fill="#ef4444" fontSize="8">
        Sobre-comprado
      </text>
      {/* Touch lower */}
      <circle cx="200" cy="75" r="5" fill="#10b981" opacity="0.9" />
      <text x="138" y="89" fill="#10b981" fontSize="8">
        Sobre-vendido
      </text>
      {/* Labels */}
      <text x="12" y="15" fill="#818cf8" fontSize="8">
        Banda Superior
      </text>
      <text x="12" y="44" fill="#94a3b8" fontSize="8">
        Media (SMA 20)
      </text>
      <text x="12" y="97" fill="#818cf8" fontSize="8">
        Banda Inferior
      </text>
    </svg>
  );
}

function VolumeChart() {
  const bars = [
    { x: 20, h: 30, high: false },
    { x: 45, h: 45, high: false },
    { x: 70, h: 25, high: false },
    { x: 95, h: 50, high: false },
    { x: 120, h: 35, high: false },
    { x: 145, h: 80, high: true },
    { x: 170, h: 70, high: true },
    { x: 195, h: 40, high: false },
    { x: 220, h: 55, high: true },
    { x: 245, h: 30, high: false },
  ];
  return (
    <svg
      viewBox="0 0 280 90"
      className="w-full h-24"
      role="img"
      aria-label="Volume chart"
    >
      {/* Bars */}
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x - 9}
          y={60 - b.h}
          width="18"
          height={b.h}
          rx="2"
          fill={b.high ? '#10b981' : '#334155'}
          opacity={b.high ? 0.85 : 0.55}
        />
      ))}
      {/* Average line */}
      <line
        x1="10"
        y1={60 - 42}
        x2="270"
        y2={60 - 42}
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeDasharray="5,3"
      />
      <text x="12" y={60 - 45} fill="#f59e0b" fontSize="9">
        Promedio
      </text>
      {/* Baseline */}
      <line x1="10" y1="62" x2="270" y2="62" stroke="#334155" strokeWidth="1" />
      {/* Legend */}
      <rect
        x="10"
        y="72"
        width="12"
        height="8"
        fill="#10b981"
        rx="1"
        opacity="0.85"
      />
      <text x="25" y="80" fill="#94a3b8" fontSize="9">
        Volumen ALTO (señal fuerte)
      </text>
      <rect
        x="165"
        y="72"
        width="12"
        height="8"
        fill="#334155"
        rx="1"
        opacity="0.55"
      />
      <text x="180" y="80" fill="#94a3b8" fontSize="9">
        Normal / Bajo
      </text>
    </svg>
  );
}

function SupportResistanceChart() {
  return (
    <svg
      viewBox="0 0 280 100"
      className="w-full h-24"
      role="img"
      aria-label="Support and resistance chart"
    >
      {/* Resistance levels */}
      <line
        x1="10"
        y1="18"
        x2="270"
        y2="18"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />
      <text x="215" y="14" fill="#ef4444" fontSize="9" fontWeight="600">
        Resistencia 2
      </text>
      <line
        x1="10"
        y1="32"
        x2="270"
        y2="32"
        stroke="#f97316"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />
      <text x="215" y="28" fill="#f97316" fontSize="9" fontWeight="600">
        Resistencia 1
      </text>
      {/* Support levels */}
      <line
        x1="10"
        y1="72"
        x2="270"
        y2="72"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />
      <text x="220" y="68" fill="#10b981" fontSize="9" fontWeight="600">
        Soporte 1
      </text>
      <line
        x1="10"
        y1="86"
        x2="270"
        y2="86"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeDasharray="6,4"
      />
      <text x="220" y="95" fill="#34d399" fontSize="9" fontWeight="600">
        Soporte 2
      </text>
      {/* Price candles area */}
      <polyline
        points="10,55 35,48 60,42 80,38 100,33 115,37 130,45 145,50 165,47 185,55 205,60 225,55 245,58 265,52"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Current price marker */}
      <circle
        cx="265"
        cy="52"
        r="4"
        fill="#a855f7"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <text x="10" y="54" fill="#94a3b8" fontSize="8">
        Precio actual ←
      </text>
    </svg>
  );
}

// ── Indicator data ─────────────────────────────────────────────────────────────

type SignalItem = { label: string; color: string; desc: string };

interface IndicatorInfo {
  title: string;
  subtitle: string;
  what: string;
  how: string;
  signals: SignalItem[];
  tip: string;
  chart: React.ReactNode;
}

function getIndicators(
  t: (key: string) => string,
): Record<IndicatorKey, IndicatorInfo> {
  const k = (s: string) => t(`market.indicators.${s}`);
  return {
    price: {
      title: k('price.title'),
      subtitle: k('price.subtitle'),
      what: k('price.what'),
      how: k('price.how'),
      signals: [
        {
          label: k('price.s0Label'),
          color: 'text-emerald-400',
          desc: k('price.s0Desc'),
        },
        {
          label: k('price.s1Label'),
          color: 'text-sky-400',
          desc: k('price.s1Desc'),
        },
        {
          label: k('price.s2Label'),
          color: 'text-amber-400',
          desc: k('price.s2Desc'),
        },
        {
          label: k('price.s3Label'),
          color: 'text-red-400',
          desc: k('price.s3Desc'),
        },
      ],
      tip: k('price.tip'),
      chart: <PriceChart />,
    },
    signalReasons: {
      title: k('signalReasons.title'),
      subtitle: k('signalReasons.subtitle'),
      what: k('signalReasons.what'),
      how: k('signalReasons.how'),
      signals: [
        {
          label: k('signalReasons.s0Label'),
          color: 'text-emerald-400',
          desc: k('signalReasons.s0Desc'),
        },
        {
          label: k('signalReasons.s1Label'),
          color: 'text-red-400',
          desc: k('signalReasons.s1Desc'),
        },
        {
          label: k('signalReasons.s2Label'),
          color: 'text-amber-400',
          desc: k('signalReasons.s2Desc'),
        },
        {
          label: k('signalReasons.s3Label'),
          color: 'text-sky-400',
          desc: k('signalReasons.s3Desc'),
        },
      ],
      tip: k('signalReasons.tip'),
      chart: (
        <svg
          viewBox="0 0 280 90"
          className="w-full h-24"
          role="img"
          aria-label="Signal factors chart"
        >
          {/* Score bar */}
          <rect x="10" y="35" width="260" height="14" rx="7" fill="#1e293b" />
          {/* Negative half */}
          <rect
            x="10"
            y="35"
            width="130"
            height="14"
            rx="7"
            fill="#ef4444"
            opacity="0.25"
          />
          {/* Positive half — score +2 out of max ~6 */}
          <rect
            x="140"
            y="35"
            width="87"
            height="14"
            rx="0"
            fill="#10b981"
            opacity="0.4"
          />
          <rect
            x="227"
            y="35"
            width="43"
            height="14"
            rx="7"
            fill="#10b981"
            opacity="0.15"
          />
          {/* Center line */}
          <line
            x1="140"
            y1="28"
            x2="140"
            y2="57"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="3,2"
          />
          <text x="136" y="24" fill="#64748b" fontSize="9" textAnchor="middle">
            0
          </text>
          {/* Current score marker */}
          <circle
            cx="207"
            cy="42"
            r="8"
            fill="#10b981"
            stroke="#fff"
            strokeWidth="1.5"
            opacity="0.9"
          />
          <text
            x="207"
            y="46"
            fill="#fff"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
          >
            +2
          </text>
          {/* Labels */}
          <text x="12" y="72" fill="#ef4444" fontSize="9">
            SELL
          </text>
          <text x="122" y="72" fill="#f59e0b" fontSize="9" textAnchor="middle">
            NEUTRAL
          </text>
          <text x="268" y="72" fill="#10b981" fontSize="9" textAnchor="end">
            BUY
          </text>
          {/* Factor pills */}
          <rect
            x="10"
            y="78"
            width="60"
            height="11"
            rx="5"
            fill="#10b981"
            opacity="0.2"
          />
          <text x="40" y="87" fill="#10b981" fontSize="8" textAnchor="middle">
            RSI oversold
          </text>
          <rect
            x="78"
            y="78"
            width="68"
            height="11"
            rx="5"
            fill="#10b981"
            opacity="0.2"
          />
          <text x="112" y="87" fill="#10b981" fontSize="8" textAnchor="middle">
            MACD cruce ↑
          </text>
          <rect
            x="154"
            y="78"
            width="56"
            height="11"
            rx="5"
            fill="#ef4444"
            opacity="0.2"
          />
          <text x="182" y="87" fill="#ef4444" fontSize="8" textAnchor="middle">
            BB superior
          </text>
          <rect
            x="218"
            y="78"
            width="52"
            height="11"
            rx="5"
            fill="#f59e0b"
            opacity="0.2"
          />
          <text x="244" y="87" fill="#f59e0b" fontSize="8" textAnchor="middle">
            Vol. normal
          </text>
        </svg>
      ),
    },
    rsi: {
      title: k('rsi.title'),
      subtitle: k('rsi.subtitle'),
      what: k('rsi.what'),
      how: k('rsi.how'),
      signals: [
        {
          label: k('rsi.s0Label'),
          color: 'text-emerald-400',
          desc: k('rsi.s0Desc'),
        },
        {
          label: k('rsi.s1Label'),
          color: 'text-amber-400',
          desc: k('rsi.s1Desc'),
        },
        {
          label: k('rsi.s2Label'),
          color: 'text-red-400',
          desc: k('rsi.s2Desc'),
        },
      ],
      tip: k('rsi.tip'),
      chart: <RsiChart />,
    },
    macd: {
      title: k('macd.title'),
      subtitle: k('macd.subtitle'),
      what: k('macd.what'),
      how: k('macd.how'),
      signals: [
        {
          label: k('macd.s0Label'),
          color: 'text-emerald-400',
          desc: k('macd.s0Desc'),
        },
        {
          label: k('macd.s1Label'),
          color: 'text-red-400',
          desc: k('macd.s1Desc'),
        },
        {
          label: k('macd.s2Label'),
          color: 'text-emerald-400',
          desc: k('macd.s2Desc'),
        },
        {
          label: k('macd.s3Label'),
          color: 'text-red-400',
          desc: k('macd.s3Desc'),
        },
      ],
      tip: k('macd.tip'),
      chart: <MacdChart />,
    },
    ema: {
      title: k('ema.title'),
      subtitle: k('ema.subtitle'),
      what: k('ema.what'),
      how: k('ema.how'),
      signals: [
        {
          label: k('ema.s0Label'),
          color: 'text-emerald-400',
          desc: k('ema.s0Desc'),
        },
        {
          label: k('ema.s1Label'),
          color: 'text-red-400',
          desc: k('ema.s1Desc'),
        },
        {
          label: k('ema.s2Label'),
          color: 'text-emerald-400',
          desc: k('ema.s2Desc'),
        },
        {
          label: k('ema.s3Label'),
          color: 'text-red-400',
          desc: k('ema.s3Desc'),
        },
      ],
      tip: k('ema.tip'),
      chart: <EmaChart />,
    },
    bollinger: {
      title: k('bollinger.title'),
      subtitle: k('bollinger.subtitle'),
      what: k('bollinger.what'),
      how: k('bollinger.how'),
      signals: [
        {
          label: k('bollinger.s0Label'),
          color: 'text-red-400',
          desc: k('bollinger.s0Desc'),
        },
        {
          label: k('bollinger.s1Label'),
          color: 'text-emerald-400',
          desc: k('bollinger.s1Desc'),
        },
        {
          label: k('bollinger.s2Label'),
          color: 'text-amber-400',
          desc: k('bollinger.s2Desc'),
        },
        {
          label: k('bollinger.s3Label'),
          color: 'text-sky-400',
          desc: k('bollinger.s3Desc'),
        },
      ],
      tip: k('bollinger.tip'),
      chart: <BollingerChart />,
    },
    volume: {
      title: k('volume.title'),
      subtitle: k('volume.subtitle'),
      what: k('volume.what'),
      how: k('volume.how'),
      signals: [
        {
          label: k('volume.s0Label'),
          color: 'text-emerald-400',
          desc: k('volume.s0Desc'),
        },
        {
          label: k('volume.s1Label'),
          color: 'text-amber-400',
          desc: k('volume.s1Desc'),
        },
        {
          label: k('volume.s2Label'),
          color: 'text-red-400',
          desc: k('volume.s2Desc'),
        },
      ],
      tip: k('volume.tip'),
      chart: <VolumeChart />,
    },
    opportunity: {
      title: k('opportunity.title'),
      subtitle: k('opportunity.subtitle'),
      what: k('opportunity.what'),
      how: k('opportunity.how'),
      signals: [
        {
          label: k('opportunity.s0Label'),
          color: 'text-emerald-400',
          desc: k('opportunity.s0Desc'),
        },
        {
          label: k('opportunity.s1Label'),
          color: 'text-red-400',
          desc: k('opportunity.s1Desc'),
        },
        {
          label: k('opportunity.s2Label'),
          color: 'text-amber-400',
          desc: k('opportunity.s2Desc'),
        },
        {
          label: k('opportunity.s3Label'),
          color: 'text-sky-400',
          desc: k('opportunity.s3Desc'),
        },
      ],
      tip: k('opportunity.tip'),
      chart: (
        <svg
          viewBox="0 0 280 100"
          className="w-full h-28"
          role="img"
          aria-label="Opportunity panel diagram"
        >
          {/* Score axis */}
          <rect x="10" y="42" width="260" height="12" rx="6" fill="#1e293b" />
          {/* Sell zone left */}
          <rect
            x="10"
            y="42"
            width="86"
            height="12"
            rx="6"
            fill="#ef4444"
            opacity="0.35"
          />
          {/* Neutral zone center */}
          <rect
            x="96"
            y="42"
            width="88"
            height="12"
            fill="#f59e0b"
            opacity="0.25"
          />
          {/* Buy zone right */}
          <rect
            x="184"
            y="42"
            width="86"
            height="12"
            rx="6"
            fill="#10b981"
            opacity="0.35"
          />
          {/* Zone labels */}
          <text
            x="53"
            y="38"
            fill="#ef4444"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
          >
            VENDER
          </text>
          <text
            x="140"
            y="38"
            fill="#f59e0b"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
          >
            ESPERAR
          </text>
          <text
            x="227"
            y="38"
            fill="#10b981"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
          >
            COMPRAR
          </text>
          {/* Score markers */}
          <line
            x1="96"
            y1="35"
            x2="96"
            y2="62"
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
          <line
            x1="184"
            y1="35"
            x2="184"
            y2="62"
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
          <text x="96" y="70" fill="#64748b" fontSize="8" textAnchor="middle">
            -4
          </text>
          <text x="184" y="70" fill="#64748b" fontSize="8" textAnchor="middle">
            +4
          </text>
          <text x="10" y="70" fill="#64748b" fontSize="8">
            -8
          </text>
          <text x="265" y="70" fill="#64748b" fontSize="8" textAnchor="end">
            +8
          </text>
          {/* Example score needle at +1 (WAIT zone) */}
          <circle
            cx="147"
            cy="48"
            r="7"
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <text
            x="147"
            y="52"
            fill="#fff"
            fontSize="8"
            fontWeight="700"
            textAnchor="middle"
          >
            +1
          </text>
          {/* Confidence bar */}
          <text x="10" y="86" fill="#94a3b8" fontSize="8">
            Confianza:
          </text>
          <rect x="65" y="78" width="160" height="8" rx="4" fill="#1e293b" />
          <rect
            x="65"
            y="78"
            width="113"
            height="8"
            rx="4"
            fill="#f59e0b"
            opacity="0.7"
          />
          <text x="232" y="86" fill="#f59e0b" fontSize="9" fontWeight="700">
            71%
          </text>
          <text x="10" y="99" fill="#64748b" fontSize="7">
            Score bajo → ESPERAR aunque % sea alto
          </text>
        </svg>
      ),
    },
    chart: {
      title: k('chart.title'),
      subtitle: k('chart.subtitle'),
      what: k('chart.what'),
      how: k('chart.how'),
      signals: [
        {
          label: k('chart.s0Label'),
          color: 'text-violet-400',
          desc: k('chart.s0Desc'),
        },
        {
          label: k('chart.s1Label'),
          color: 'text-orange-400',
          desc: k('chart.s1Desc'),
        },
        {
          label: k('chart.s2Label'),
          color: 'text-amber-400',
          desc: k('chart.s2Desc'),
        },
        {
          label: k('chart.s3Label'),
          color: 'text-slate-400',
          desc: k('chart.s3Desc'),
        },
      ],
      tip: k('chart.tip'),
      chart: (
        <svg
          viewBox="0 0 280 100"
          className="w-full h-28"
          role="img"
          aria-label="Candlestick chart with overlays"
        >
          {/* Grid lines */}
          {[20, 40, 60, 80].map((y) => (
            <line
              key={y}
              x1="10"
              y1={y}
              x2="270"
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
          ))}
          {/* Candles */}
          {[
            { x: 20, o: 70, c: 55, h: 75, l: 50, bull: false },
            { x: 40, o: 55, c: 60, h: 65, l: 48, bull: true },
            { x: 60, o: 60, c: 52, h: 63, l: 45, bull: false },
            { x: 80, o: 52, c: 58, h: 62, l: 48, bull: true },
            { x: 100, o: 58, c: 65, h: 68, l: 55, bull: true },
            { x: 120, o: 65, c: 60, h: 70, l: 56, bull: false },
            { x: 140, o: 60, c: 68, h: 72, l: 57, bull: true },
            { x: 160, o: 68, c: 74, h: 78, l: 65, bull: true },
            { x: 180, o: 74, c: 70, h: 80, l: 66, bull: false },
            { x: 200, o: 70, c: 76, h: 82, l: 68, bull: true },
            { x: 220, o: 76, c: 72, h: 79, l: 68, bull: false },
            { x: 240, o: 72, c: 78, h: 83, l: 70, bull: true },
          ].map(({ x, o, c, h, l, bull }) => (
            <g key={x}>
              <line
                x1={x}
                y1={h}
                x2={x}
                y2={l}
                stroke={bull ? '#10b981' : '#ef4444'}
                strokeWidth="1"
              />
              <rect
                x={x - 5}
                y={Math.min(o, c)}
                width={10}
                height={Math.max(Math.abs(o - c), 2)}
                fill={bull ? '#10b981' : '#ef4444'}
              />
            </g>
          ))}
          {/* S line (green) */}
          <line
            x1="10"
            y1="72"
            x2="270"
            y2="72"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4,3"
            opacity="0.9"
          />
          <text x="14" y="70" fill="#10b981" fontSize="7" fontWeight="700">
            S
          </text>
          {/* R line (red) */}
          <line
            x1="10"
            y1="28"
            x2="270"
            y2="28"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4,3"
            opacity="0.9"
          />
          <text x="14" y="26" fill="#ef4444" fontSize="7" fontWeight="700">
            R
          </text>
          {/* EMA 9 (violet) */}
          <line
            x1="10"
            y1="62"
            x2="270"
            y2="62"
            stroke="#a78bfa"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <text x="248" y="60" fill="#a78bfa" fontSize="7">
            EMA 9
          </text>
          {/* EMA 200 (orange dashed) */}
          <line
            x1="10"
            y1="85"
            x2="270"
            y2="85"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray="6,3"
            opacity="0.7"
          />
          <text x="232" y="83" fill="#f97316" fontSize="7">
            EMA 200
          </text>
        </svg>
      ),
    },
    supportResistance: {
      title: k('supportResistance.title'),
      subtitle: k('supportResistance.subtitle'),
      what: k('supportResistance.what'),
      how: k('supportResistance.how'),
      signals: [
        {
          label: k('supportResistance.s0Label'),
          color: 'text-red-400',
          desc: k('supportResistance.s0Desc'),
        },
        {
          label: k('supportResistance.s1Label'),
          color: 'text-emerald-400',
          desc: k('supportResistance.s1Desc'),
        },
        {
          label: k('supportResistance.s2Label'),
          color: 'text-sky-400',
          desc: k('supportResistance.s2Desc'),
        },
      ],
      tip: k('supportResistance.tip'),
      chart: <SupportResistanceChart />,
    },
  };
}

// ── Modal Component ────────────────────────────────────────────────────────────

interface IndicatorInfoModalProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  indicatorKey: IndicatorKey | null;
  onClose: () => void;
}

export function IndicatorInfoModal({
  t,
  indicatorKey,
  onClose,
}: IndicatorInfoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!indicatorKey) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [indicatorKey, onClose]);

  if (!indicatorKey) return null;

  const info = getIndicators(t)[indicatorKey];

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={info.title}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div>
            <h2 className="text-base font-bold leading-tight">{info.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {info.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={t('market.modalClose')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* What is it */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('market.modalWhat')}
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {info.what}
            </p>
          </section>

          {/* Visual chart */}
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('market.modalVisualization')}
            </h3>
            {info.chart}
          </section>

          {/* How it works */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('market.modalHow')}
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {info.how}
            </p>
          </section>

          {/* Signals */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('market.modalSignals')}
            </h3>
            <div className="space-y-2">
              {info.signals.map((s) => (
                <div
                  key={s.label}
                  className="flex gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      'shrink-0 text-xs font-bold font-mono pt-0.5 min-w-[110px]',
                      s.color,
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Tip */}
          <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs leading-relaxed text-amber-300/90">
              {info.tip}
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
