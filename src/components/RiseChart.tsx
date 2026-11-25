// Height (or rise) against hours since feeding, for one or more cycles.

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Readings: hours since feeding, value. */
  points: { h: number; v: number }[];
  /** Streak lines: the peak happened at or before h. */
  streaks: { h: number; v: number }[];
}

interface Props {
  series: Series[];
  unit: "in" | "x";
  /** A dashed reference line, e.g. the start height or 2x. */
  guides?: { v: number; label: string }[];
}

export function RiseChart({ series, unit, guides = [] }: Props) {
  const W = 340, H = 190, L = 34, R = 10, T = 12, B = 28;
  const all = series.flatMap((s) => [...s.points, ...s.streaks]);
  const maxH = Math.max(8, ...all.map((p) => p.h)) ;
  const xMax = Math.ceil(maxH / 4) * 4;
  const vMax = Math.max(unit === "x" ? 3 : 4, ...all.map((p) => p.v), ...guides.map((g) => g.v)) * 1.08;
  const yMax = unit === "x" ? Math.ceil(vMax * 2) / 2 : Math.ceil(vMax);
  const x = (h: number) => L + (h / xMax) * (W - L - R);
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const xTicks = Array.from({ length: xMax / 4 + 1 }, (_, i) => i * 4);
  const yStep = unit === "x" ? 0.5 : 1;
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep).filter((v) => unit !== "x" || v >= 0.5);

  if (!series.some((s) => s.points.length)) {
    return <p className="muted chart-empty">No readings in this cycle yet. Snap the jar to start the chart.</p>;
  }

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rise over time since feeding">
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
            <text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{unit === "x" ? `${v}×` : `${v}″`}</text>
          </g>
        ))}
        {xTicks.map((h) => (
          <text key={`x${h}`} x={x(h)} y={H - 10} className="axis" textAnchor="middle">{h}h</text>
        ))}
        {guides.map((g) => (
          <g key={g.label}>
            <line x1={L} x2={W - R} y1={y(g.v)} y2={y(g.v)} className="guide" />
            <text x={W - R - 2} y={y(g.v) - 4} className="axis" textAnchor="end">{g.label}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            {s.points.length > 1 && (
              <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                points={s.points.map((p) => `${x(p.h)},${y(p.v)}`).join(" ")} />
            )}
            {s.points.map((p, i) => <circle key={i} cx={x(p.h)} cy={y(p.v)} r="3.5" fill={s.color} />)}
            {s.streaks.map((p, i) => (
              <g key={`s${i}`}>
                <line x1={x(Math.max(0, p.h - 3))} x2={x(p.h)} y1={y(p.v)} y2={y(p.v)} stroke={s.color} strokeWidth="2" strokeDasharray="3 3" />
                <path d={`M${x(p.h)} ${y(p.v) - 5} l5 5 l-5 5 l-5 -5z`} fill="var(--card)" stroke={s.color} strokeWidth="2" />
              </g>
            ))}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </figcaption>
      )}
    </figure>
  );
}
