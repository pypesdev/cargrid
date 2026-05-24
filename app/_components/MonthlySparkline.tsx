import type { FlowMonthlyPoint } from "../../src/lib/dashboard/queries";

export interface MonthlySparklineProps {
  points: FlowMonthlyPoint[];
}

export function MonthlySparkline({ points }: MonthlySparklineProps) {
  if (points.length === 0) {
    return (
      <div
        data-testid="monthly-sparkline-empty"
        className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500"
      >
        No monthly data for the current filter.
      </div>
    );
  }
  const width = 480;
  const height = 120;
  const padX = 32;
  const padY = 16;
  const max = Math.max(...points.map((p) => p.valueUsd), 1);
  const stepX =
    points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = padX + i * stepX;
      const y = padY + (height - padY * 2) * (1 - p.valueUsd / max);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <figure
      aria-label="Monthly value (USD) for selected filters"
      data-testid="monthly-sparkline"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <figcaption className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Monthly value (USD)
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="false"
        className="h-auto w-full"
      >
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="2" />
        {points.map((p, i) => {
          const x = padX + i * stepX;
          const y = padY + (height - padY * 2) * (1 - p.valueUsd / max);
          return (
            <circle
              key={`${p.year}-${p.month}-${i}`}
              cx={x}
              cy={y}
              r="2.5"
              fill="#1d4ed8"
            >
              <title>{`${p.year}-${String(p.month).padStart(2, "0")}: $${new Intl.NumberFormat("en-US").format(p.valueUsd)}`}</title>
            </circle>
          );
        })}
      </svg>
    </figure>
  );
}
