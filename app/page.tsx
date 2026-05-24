import { Suspense } from "react";
import { getOverviewSummary } from "../src/lib/dashboard/queries";
import { StatTiles } from "./_components/StatTiles";
import { TopCorridorsTable } from "./_components/TopCorridorsTable";
import { WorldChoropleth } from "./_components/WorldChoropleth";
import { ErrorState } from "./_components/ErrorState";

export const dynamic = "force-dynamic";

function OverviewLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="overview-loading"
      className="space-y-4 text-sm text-gray-500"
    >
      <p>Loading dashboard…</p>
    </div>
  );
}

function OverviewBody() {
  let summary;
  try {
    summary = getOverviewSummary();
  } catch (err) {
    return (
      <ErrorState
        title="Could not load overview"
        detail={err instanceof Error ? err.message : "Unknown error"}
      />
    );
  }
  return (
    <div className="space-y-8" data-testid="overview-body">
      <StatTiles stats={summary.stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WorldChoropleth
            entries={summary.choropleth}
            year={summary.latestYear}
          />
        </div>
        <TopCorridorsTable
          corridors={summary.topCorridors}
          year={summary.latestYear}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Trade overview
        </h1>
        <p className="text-sm text-gray-500">
          Most-recent year of US import flows, top corridors, and ingestion
          health.
        </p>
      </header>
      <Suspense fallback={<OverviewLoading />}>
        <OverviewBody />
      </Suspense>
    </main>
  );
}
