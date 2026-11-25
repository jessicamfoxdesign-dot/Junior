// A drawing of the jar: Junior's current level, the start line and the
// highest streak, on an inch scale like the one printed on the real jar.

interface Props {
  level: number | null;
  baseline: number | null;
  streak: number | null;
  /** Top of the scale, inches. The real jar goes to 5½. */
  top?: number;
}

export function Jar({ level, baseline, streak, top: topIn }: Props) {
  const top = Math.max(topIn ?? 5.5, Math.ceil(((Math.max(level ?? 0, streak ?? 0)) + 0.5) * 2) / 2);
  const W = 150, H = 260;
  const glass = { x: 22, y: 30, w: 106, h: 214 };
  const y = (inches: number) => glass.y + glass.h - (inches / top) * glass.h;
  const ticks: number[] = [];
  for (let t = 0.25; t <= top - 0.2 + 1e-9; t += 0.25) ticks.push(Math.round(t * 100) / 100);

  return (
    <svg className="jar" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={level != null ? `Junior is at ${level} inches` : "No reading yet"}>
      <defs>
        <clipPath id="glass">
          <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} rx="14" />
        </clipPath>
        <linearGradient id="starter" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--starter-top)" />
          <stop offset="1" stopColor="var(--starter)" />
        </linearGradient>
      </defs>
      {/* lid */}
      <rect x={glass.x - 4} y={glass.y - 14} width={glass.w + 8} height="16" rx="5" className="jar-lid" />
      <rect x={W / 2 - 9} y={glass.y - 24} width="18" height="12" rx="4" className="jar-lid" />
      <g clipPath="url(#glass)">
        <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} className="jar-air" />
        {level != null && (
          <rect x={glass.x} y={y(level)} width={glass.w} height={glass.y + glass.h - y(level)} fill="url(#starter)" />
        )}
        {streak != null && (
          <path className="jar-streak"
            d={`M${glass.x} ${y(streak)} q 12 6 26 1 t 26 3 t 26 -2 t 28 2`} />
        )}
      </g>
      <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} rx="14" className="jar-glass" />
      {ticks.map((t) => {
        const half = Math.abs(t * 2 - Math.round(t * 2)) < 1e-9;
        const whole = Math.abs(t - Math.round(t)) < 1e-9;
        return (
          <g key={t}>
            <line x1={glass.x + 6} x2={glass.x + 6 + (whole ? 26 : half ? 20 : 11)} y1={y(t)} y2={y(t)} className="jar-tick" />
            {half && <text x={glass.x + 54} y={y(t) + 4} className="jar-label">{label(t)}</text>}
          </g>
        );
      })}
      {baseline != null && (
        <g>
          <line x1={glass.x + glass.w - 30} x2={glass.x + glass.w + 6} y1={y(baseline)} y2={y(baseline)} className="jar-start" />
          <text x={glass.x + glass.w + 8} y={y(baseline) + 4} className="jar-note">fed</text>
        </g>
      )}
      {baseline != null && baseline * 2 <= top && (
        <g>
          <line x1={glass.x + glass.w - 30} x2={glass.x + glass.w + 6} y1={y(baseline * 2)} y2={y(baseline * 2)} className="jar-double" />
          <text x={glass.x + glass.w + 8} y={y(baseline * 2) + 4} className="jar-note">2×</text>
        </g>
      )}
    </svg>
  );
}

function label(t: number): string {
  const whole = Math.floor(t);
  const half = t - whole > 0.25;
  return `${whole || ""}${half ? "½" : ""}″`;
}
