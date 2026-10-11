import type { ChartPoint } from '../lib/summary';

interface MoodChartProps {
  points: ChartPoint[];
}

const W = 560;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };

/** Before/after mood per walk: a grey dot (before), a green dot (after), a line between them. */
export function MoodChart({ points }: MoodChartProps) {
  if (points.length === 0) {
    return <p className="muted">Finish a walk and rate it to see your before/after chart.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (mood: number) => PAD.top + ((3 - mood) / 6) * innerH;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const description = points.map((p) => `${fmt(p.date)}: ${p.before} before, ${p.after} after`).join('; ');

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Mood before and after each walk</title>
        <desc id="chart-desc">{description}</desc>
        {[-3, 0, 3].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-stone-200 dark:stroke-stone-800"
              strokeDasharray={v === 0 ? undefined : '4 4'}
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-stone-400 text-[15px] sm:text-[11px]">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.id}>
            <line
              x1={x(i)}
              x2={x(i)}
              y1={y(p.before)}
              y2={y(p.after)}
              strokeWidth={3}
              strokeLinecap="round"
              className={p.after >= p.before ? 'stroke-sprout-300 dark:stroke-sprout-700' : 'stroke-amber-300 dark:stroke-amber-700'}
            />
            <circle cx={x(i)} cy={y(p.before)} r={5} className="fill-stone-400 dark:fill-stone-500" />
            <circle cx={x(i)} cy={y(p.after)} r={5} className="fill-sprout-600 dark:fill-sprout-400" />
            {(points.length <= 7 || i % 2 === 0) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-stone-400 text-[15px] sm:text-[11px]">
                {fmt(p.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="flex gap-4 text-xs text-stone-500 dark:text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-stone-400" aria-hidden="true" /> Before
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sprout-600 dark:bg-sprout-400" aria-hidden="true" /> After
          the walk
        </span>
      </figcaption>
    </figure>
  );
}
