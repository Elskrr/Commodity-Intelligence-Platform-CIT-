import { cn } from "@/lib/utils";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Overrides the automatic bull/bear colouring. */
  tone?: "bull" | "bear" | "info" | "muted" | "neutral";
  /** Fills the area under the line with a faint wash. */
  fill?: boolean;
};

const TONE_COLORS: Record<string, string> = {
  bull: "var(--color-bull)",
  bear: "var(--color-bear)",
  info: "var(--color-info)",
  muted: "var(--color-ink-dim)",
  neutral: "var(--color-neutral-quote)",
};

/**
 * Dependency-free SVG sparkline — cheap enough to render dozens per page
 * without the overhead of a full charting library.
 */
export function Sparkline({
  data,
  width = 72,
  height = 20,
  className,
  tone,
  fill = false,
}: SparklineProps) {
  if (data.length < 2) {
    return <div className={cn("h-5", className)} aria-hidden />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((value, i) => {
    const x = i * stepX;
    const y = height - ((value - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const resolvedTone =
    tone ?? (data[data.length - 1] >= data[0] ? "bull" : "bear");
  const color = TONE_COLORS[resolvedTone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-hidden
    >
      {/* Kept quieter than the price it accompanies. */}
      {fill ? (
        <path
          d={`${path} L${width},${height} L0,${height} Z`}
          fill={color}
          opacity={0.07}
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={1.35}
        fill={color}
      />
    </svg>
  );
}
