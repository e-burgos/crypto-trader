import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export type IndicatorKey =
  | 'price'
  | 'signalReasons'
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

const INDICATORS: Record<IndicatorKey, IndicatorInfo> = {
  price: {
    title: 'Precio Actual',
    subtitle: 'Precio de mercado en tiempo real + señal consolidada',
    what: 'Esta tarjeta muestra el precio actual del par seleccionado, obtenido en tiempo real via WebSocket desde el exchange. También calcula y muestra una señal consolidada (BUY, SELL, HOLD o NEUTRAL) basada en el agregado de todos los indicadores técnicos.',
    how: 'El precio se actualiza cada segundo desde el stream de mercado. La señal se deriva calculando un "score" ponderado de RSI, MACD, EMA, Bollinger Bands, Volumen y niveles de Soporte/Resistencia. Scores positivos apuntan a BUY, negativos a SELL, y cercanos a cero a NEUTRAL u HOLD.',
    signals: [
      {
        label: 'BUY — Comprar',
        color: 'text-emerald-400',
        desc: 'Score consolidado positivo alto. La mayoría de indicadores sugieren condiciones alcistas.',
      },
      {
        label: 'HOLD — Mantener',
        color: 'text-sky-400',
        desc: 'Score moderado. Señales mixtas. El agente puede abrir posición con precaución.',
      },
      {
        label: 'NEUTRAL',
        color: 'text-amber-400',
        desc: 'Score cercano a cero. Los indicadores no tienen consenso claro. Se recomienda esperar.',
      },
      {
        label: 'SELL — Vender',
        color: 'text-red-400',
        desc: 'Score consolidado negativo. La mayoría de indicadores sugieren condiciones bajistas.',
      },
    ],
    tip: '💡 El agente de trading usa exactamente esta señal consolidada para decidir si ejecutar una orden. Un score cercano a 0 generará NEUTRAL — el agente no operará.',
    chart: <PriceChart />,
  },
  signalReasons: {
    title: 'Factores de la Señal',
    subtitle: 'Por qué el sistema emite BUY, SELL, HOLD o NEUTRAL',
    what: 'Los Factores de la Señal son los motivos individuales que cada indicador técnico aporta al score consolidado. Cada factor es una observación puntual: “RSI en zona oversold”, “MACD cruce alcista”, etc. Juntos forman el veredicto final.',
    how: 'El sistema evalúa RSI, MACD, EMA, Bollinger Bands, Volumen y Soporte/Resistencia. Cada uno aporta +1, -1 o 0 al score. Si el score supera el umbral positivo configurado → BUY; umbral negativo → SELL; cercano a 0 → NEUTRAL; moderado → HOLD.',
    signals: [
      {
        label: 'Factores alcistas',
        color: 'text-emerald-400',
        desc: 'Condiciones como RSI oversold, MACD cruce positivo, precio sobre EMA, volumen alto. Suman al score.',
      },
      {
        label: 'Factores bajistas',
        color: 'text-red-400',
        desc: 'Condiciones como RSI overbought, MACD cruce negativo, precio bajo EMA, Bollinger sobre banda superior. Restan del score.',
      },
      {
        label: 'Factores neutrales',
        color: 'text-amber-400',
        desc: 'Indicadores sin señal clara (RSI en zona media, volumen normal). No suman ni restan.',
      },
      {
        label: 'Score consolidado',
        color: 'text-sky-400',
        desc: 'La suma de todos los factores. Visible como “Puntaje: +2” en la tarjeta de precio. Cuanto mayor el valor absoluto, más convicción tiene la señal.',
      },
    ],
    tip: '💡 Si ves pocos factores o factores contradictorios (algunos alcistas y algunos bajistas), el mercado está en equilibrio. El agente usará NEUTRAL y no operará hasta tener más claridad.',
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
    title: 'RSI — Índice de Fuerza Relativa',
    subtitle: 'Relative Strength Index (14 períodos)',
    what: 'El RSI mide qué tan fuerte o débil se mueve un activo. Imagína un péndulo: si se fue demasiado hacia un lado, es probable que vuelva al centro.',
    how: 'Va de 0 a 100. Las zonas clave son 30 y 70. Cuando baja de 30, el mercado posiblemente exageró a la baja ("rebote probable"). Cuando sube de 70, posiblemente exageró al alza ("caída probable").',
    signals: [
      {
        label: '< 30 — OVERSOLD',
        color: 'text-emerald-400',
        desc: 'El precio cayó mucho. Posible oportunidad de compra.',
      },
      {
        label: '30–70 — NEUTRAL',
        color: 'text-amber-400',
        desc: 'Zona de equilibrio, sin señal clara.',
      },
      {
        label: '> 70 — OVERBOUGHT',
        color: 'text-red-400',
        desc: 'El precio subió demasiado. Posible corrección.',
      },
    ],
    tip: '💡 El RSI funciona mejor en mercados laterales. En tendencias fuertes puede estar "overbought" durante mucho tiempo.',
    chart: <RsiChart />,
  },
  macd: {
    title: 'MACD — Convergencia/Divergencia de Medias',
    subtitle: 'Moving Average Convergence Divergence (12, 26, 9)',
    what: 'El MACD compara dos medias móviles para detectar cambios de tendencia. Es como medir si el motor del precio está acelerando o frenando.',
    how: 'Tiene 3 componentes: la línea MACD (rápida), la línea de Señal (lenta) y el Histograma (diferencia). Cuando la línea MACD cruza por encima de la Señal → momento alcista. Cuando cruza por debajo → momento bajista.',
    signals: [
      {
        label: 'BULLISH',
        color: 'text-emerald-400',
        desc: 'MACD cruzó por encima de la Señal. Momentum positivo.',
      },
      {
        label: 'BEARISH',
        color: 'text-red-400',
        desc: 'MACD cruzó por debajo de la Señal. Momentum negativo.',
      },
      {
        label: 'Histograma +',
        color: 'text-emerald-400',
        desc: 'Barras verdes: el momentum alcista se fortalece.',
      },
      {
        label: 'Histograma -',
        color: 'text-red-400',
        desc: 'Barras rojas: el momentum bajista se fortalece.',
      },
    ],
    tip: '💡 El MACD es un indicador retrasado, confirma tendencias. Úsalo junto con el RSI para señales más confiables.',
    chart: <MacdChart />,
  },
  ema: {
    title: 'Cruce de EMAs — Tendencia de Medias Móviles',
    subtitle: 'Exponential Moving Averages (9, 21, 200)',
    what: 'Las EMAs son promedios del precio que dan más peso a los datos recientes. Son como la "temperatura promedio" del mercado en diferentes períodos de tiempo.',
    how: 'Cuando la EMA rápida (9) cruza por encima de la lenta (21) es una señal alcista ("Golden Cross" mini). Cuando el precio está sobre la EMA 200, la tendencia a largo plazo es alcista.',
    signals: [
      {
        label: 'BULLISH',
        color: 'text-emerald-400',
        desc: 'EMA 9 > EMA 21 y precio sobre EMAs. Tendencia al alza.',
      },
      {
        label: 'BEARISH',
        color: 'text-red-400',
        desc: 'EMA 9 < EMA 21. El precio está cayendo en promedio.',
      },
      {
        label: 'ABOVE EMA 200',
        color: 'text-emerald-400',
        desc: 'Tendencia a largo plazo alcista. Mercado "sano".',
      },
      {
        label: 'BELOW EMA 200',
        color: 'text-red-400',
        desc: 'Tendencia a largo plazo bajista. Precaución.',
      },
    ],
    tip: '💡 La EMA 200 es la más importante para traders a largo plazo. Muchos fondos compran cuando el precio está por encima de ella.',
    chart: <EmaChart />,
  },
  bollinger: {
    title: 'Bandas de Bollinger',
    subtitle: 'Volatilidad del mercado (SMA 20 ± 2σ)',
    what: 'Las Bandas de Bollinger son como un "carril" dinámico para el precio. Se expanden cuando el mercado es volátil y se contraen cuando está tranquilo.',
    how: 'Hay 3 líneas: media central (SMA 20) y dos bandas a 2 desviaciones estándar. El precio suele mantenerse dentro de las bandas el ~95% del tiempo. Tocar la banda es una advertencia, salirse es una señal.',
    signals: [
      {
        label: 'ABOVE — Sobre banda superior',
        color: 'text-red-400',
        desc: 'El precio rompió el techo. Posible sobrecompra o inicio de breakout.',
      },
      {
        label: 'BELOW — Bajo banda inferior',
        color: 'text-emerald-400',
        desc: 'El precio tocó el suelo. Posible sobreventa o inicio de caída.',
      },
      {
        label: 'WIDE — Bandas anchas',
        color: 'text-amber-400',
        desc: 'Alta volatilidad. Movimientos bruscos probables.',
      },
      {
        label: 'NARROW — Bandas estrechas',
        color: 'text-sky-400',
        desc: '"Squeeze" o compresión. Suele preceder un movimiento grande.',
      },
    ],
    tip: '💡 Las bandas estrechas (squeeze) son la señal más poderosa: el mercado está acumulando energía para un gran movimiento.',
    chart: <BollingerChart />,
  },
  volume: {
    title: 'Volumen de Operaciones',
    subtitle: 'Cantidad de activo negociado (vs. promedio)',
    what: 'El volumen muestra cuántas personas están comprando o vendiendo. Es la "convicción" detrás de un movimiento de precio. Sin volumen, los movimientos no son sostenibles.',
    how: 'Se compara el volumen actual con el promedio de los últimos períodos. Un volumen 2x el promedio con precio al alza confirma la tendencia. Un volumen muy bajo sugiere que el movimiento puede revertirse.',
    signals: [
      {
        label: 'HIGH — Volumen alto',
        color: 'text-emerald-400',
        desc: 'Ratio > 1.5x. Movimiento con fuerte convicción del mercado.',
      },
      {
        label: 'NORMAL — Volumen normal',
        color: 'text-amber-400',
        desc: 'Ratio ~ 1x. Actividad habitual, sin señal especial.',
      },
      {
        label: 'LOW — Volumen bajo',
        color: 'text-red-400',
        desc: 'Ratio < 0.7x. Poco interés. Posible consolidación o reversión.',
      },
    ],
    tip: '💡 Regla de oro: el volumen precede al precio. Si el precio sube pero el volumen cae, la tendencia está perdiendo fuerza.',
    chart: <VolumeChart />,
  },
  supportResistance: {
    title: 'Soporte y Resistencia',
    subtitle: 'Niveles clave de precio detectados automáticamente',
    what: 'Los soportes y resistencias son zonas de precio donde históricamente el mercado "rebota". El soporte es como el suelo y la resistencia como el techo.',
    how: 'Se identifican buscando niveles donde el precio se detuvo varias veces. Si el precio rompe una resistencia, ésta puede convertirse en nuevo soporte. Si rompe un soporte, puede convertirse en resistencia.',
    signals: [
      {
        label: 'Resistencia',
        color: 'text-red-400',
        desc: 'Nivel por encima donde vendedores toman control. El precio tiende a bajar desde ahí.',
      },
      {
        label: 'Soporte',
        color: 'text-emerald-400',
        desc: 'Nivel por debajo donde compradores toman control. El precio tiende a rebotar desde ahí.',
      },
      {
        label: '% distancia',
        color: 'text-sky-400',
        desc: 'Qué tan lejos está el nivel del precio actual. Más cerca = más relevante ahora.',
      },
    ],
    tip: '💡 Cuantas más veces el precio toca un nivel sin romperlo, más fuerte es ese nivel. Un nivel "probado" múltiples veces es muy significativo.',
    chart: <SupportResistanceChart />,
  },
};

// ── Modal Component ────────────────────────────────────────────────────────────

interface IndicatorInfoModalProps {
  indicatorKey: IndicatorKey | null;
  onClose: () => void;
}

export function IndicatorInfoModal({
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

  const info = INDICATORS[indicatorKey];

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
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* What is it */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ¿Qué es?
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {info.what}
            </p>
          </section>

          {/* Visual chart */}
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visualización
            </h3>
            {info.chart}
          </section>

          {/* How it works */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ¿Cómo funciona?
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {info.how}
            </p>
          </section>

          {/* Signals */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Señales
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
