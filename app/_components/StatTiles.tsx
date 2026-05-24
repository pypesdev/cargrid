import type { OverviewStats } from "../../src/lib/dashboard/queries";

export interface StatTilesProps {
  stats: OverviewStats;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function StatTiles({ stats }: StatTilesProps) {
  const lastRunMostRecent = stats.perSource
    .map((s) => s.lastRunAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  const tiles = [
    {
      label: "Trade flow rows",
      value: formatNumber(stats.totalTradeRows),
      detail: `${stats.perSource.length} sources`,
    },
    {
      label: "Comparables",
      value: formatNumber(stats.totalComparables),
      detail: "sold auction listings",
    },
    {
      label: "Tariffs covered",
      value: formatNumber(stats.totalTariffs),
      detail: "HS × destination rows",
    },
    {
      label: "Last ingestion",
      value: formatDate(lastRunMostRecent ?? null),
      detail: `${stats.totalShippingRows} shipping rates`,
    },
  ];
  return (
    <section
      aria-label="Ingestion stats"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="stat-tiles"
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t.label}
          </p>
          <p
            className="mt-1 text-2xl font-semibold text-gray-900"
            data-testid={`stat-value-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {t.value}
          </p>
          <p className="mt-1 text-xs text-gray-500">{t.detail}</p>
        </div>
      ))}
    </section>
  );
}
