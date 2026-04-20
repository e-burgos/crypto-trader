export function SparklineChart() {
  return (
    <svg
      viewBox="0 0 100 32"
      className="h-8 w-full fill-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.35 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>
      <path
        d="M0,28 L10,26 L20,24 L28,20 L36,22 L46,17 L54,14 L62,12 L70,9 L78,6 L88,4 L100,1 L100,32 L0,32 Z"
        fill="url(#sparkGrad)"
      />
      <path
        d="M0,28 L10,26 L20,24 L28,20 L36,22 L46,17 L54,14 L62,12 L70,9 L78,6 L88,4 L100,1"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
