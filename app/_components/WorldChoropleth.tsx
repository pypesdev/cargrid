import type { ChoroplethEntry } from "../../src/lib/dashboard/queries";
import { EmptyState } from "./EmptyState";
import { COUNTRY_RECTS } from "./choropleth-data";

export interface WorldChoroplethProps {
  entries: ChoroplethEntry[];
  year: number | null;
}

function formatUsdCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function colorScale(value: number, max: number): string {
  if (max <= 0) return "#e5e7eb";
  const t = Math.max(0.05, Math.min(1, value / max));
  // Tailwind blue-900 → blue-200 gradient via inline interpolation.
  const start = { r: 219, g: 234, b: 254 };
  const end = { r: 30, g: 58, b: 138 };
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function WorldChoropleth({ entries, year }: WorldChoroplethProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No trade volume to map"
        detail="Once trade flow data is ingested it will appear here."
      />
    );
  }
  const max = entries.reduce((m, e) => Math.max(m, e.valueUsd), 0);
  const valueByCountry = new Map(entries.map((e) => [e.partner, e.valueUsd]));

  return (
    <figure
      aria-label="US import value by partner country"
      data-testid="world-choropleth"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <figcaption className="mb-3 flex items-baseline justify-between text-sm text-gray-600">
        <span className="font-medium text-gray-800">
          US imports by partner country {year ? `(${year})` : ""}
        </span>
        <span className="text-xs text-gray-500">
          Max {formatUsdCompact(max)}
        </span>
      </figcaption>
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label="World choropleth of trade volume"
        className="h-auto w-full"
      >
        <rect x="0" y="0" width="720" height="360" fill="#f8fafc" />
        {COUNTRY_RECTS.map((c) => {
          const value = valueByCountry.get(c.iso2) ?? 0;
          const fill = value > 0 ? colorScale(value, max) : "#e5e7eb";
          return (
            <g key={c.iso2}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                fill={fill}
                stroke="#94a3b8"
                strokeWidth="0.5"
                data-iso2={c.iso2}
                data-value={value}
              >
                <title>{`${c.name} (${c.iso2}): ${formatUsdCompact(value)}`}</title>
              </rect>
              <text
                x={c.x + c.w / 2}
                y={c.y + c.h / 2 + 3}
                textAnchor="middle"
                fontSize="8"
                fill={value > max * 0.55 ? "#f8fafc" : "#1f2937"}
                pointerEvents="none"
              >
                {c.iso2}
              </text>
            </g>
          );
        })}
      </svg>
      <ol
        aria-label="Top partners legend"
        className="mt-3 grid grid-cols-2 gap-1 text-xs text-gray-600 sm:grid-cols-3"
        data-testid="choropleth-legend"
      >
        {entries.slice(0, 6).map((e) => (
          <li key={e.partner} className="flex items-center justify-between">
            <span className="font-mono text-gray-700">{e.partner}</span>
            <span className="font-mono">{formatUsdCompact(e.valueUsd)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
