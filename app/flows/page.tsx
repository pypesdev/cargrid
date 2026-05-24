import { Suspense } from "react";
import {
  getFlowFilterOptions,
  getFlows,
  type FlowFilter,
} from "../../src/lib/dashboard/queries";
import { ErrorState } from "../_components/ErrorState";
import { FlowFilters } from "../_components/FlowFilters";
import { FlowsTable } from "../_components/FlowsTable";
import { MonthlySparkline } from "../_components/MonthlySparkline";

export const dynamic = "force-dynamic";

const FLOWS_LIMIT = 200;

interface FlowsSearchParams {
  hs?: string;
  reporter?: string;
  partner?: string;
  yearFrom?: string;
  yearTo?: string;
  direction?: string;
}

function parseSearchParams(raw: FlowsSearchParams): FlowFilter {
  const filter: FlowFilter = {};
  if (raw.hs) filter.hsCode = raw.hs;
  if (raw.reporter) filter.reporter = raw.reporter;
  if (raw.partner) filter.partner = raw.partner;
  const yf = raw.yearFrom ? Number(raw.yearFrom) : undefined;
  const yt = raw.yearTo ? Number(raw.yearTo) : undefined;
  if (yf !== undefined && Number.isFinite(yf)) filter.yearFrom = yf;
  if (yt !== undefined && Number.isFinite(yt)) filter.yearTo = yt;
  if (raw.direction === "import" || raw.direction === "export") {
    filter.flowDirection = raw.direction;
  }
  return filter;
}

function FlowsLoading() {
  return (
    <p
      role="status"
      aria-busy="true"
      data-testid="flows-loading"
      className="text-sm text-gray-500"
    >
      Loading flows…
    </p>
  );
}

interface FlowsBodyProps {
  filter: FlowFilter;
}

function FlowsBody({ filter }: FlowsBodyProps) {
  try {
    const result = getFlows(filter);
    return (
      <div className="space-y-4" data-testid="flows-body">
        <FlowFilters
          filterOptions={result.filterOptions}
          initial={{
            hsCode: filter.hsCode,
            reporter: filter.reporter,
            partner: filter.partner,
            yearFrom: filter.yearFrom,
            yearTo: filter.yearTo,
            flowDirection: filter.flowDirection,
          }}
        />
        <MonthlySparkline points={result.monthly} />
        <FlowsTable
          rows={result.rows}
          total={result.total}
          limit={FLOWS_LIMIT}
        />
      </div>
    );
  } catch (err) {
    const filterOptions = safeOptions();
    return (
      <div className="space-y-4">
        <FlowFilters
          filterOptions={filterOptions}
          initial={{
            hsCode: filter.hsCode,
            reporter: filter.reporter,
            partner: filter.partner,
            yearFrom: filter.yearFrom,
            yearTo: filter.yearTo,
            flowDirection: filter.flowDirection,
          }}
        />
        <ErrorState
          title="Could not load flows"
          detail={err instanceof Error ? err.message : "Unknown error"}
        />
      </div>
    );
  }
}

function safeOptions() {
  try {
    return getFlowFilterOptions();
  } catch {
    return { hsCodes: [], reporters: [], partners: [], years: [] };
  }
}

export default async function FlowsPage({
  searchParams,
}: {
  searchParams: Promise<FlowsSearchParams>;
}) {
  const raw = await searchParams;
  const filter = parseSearchParams(raw);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bilateral flow explorer
        </h1>
        <p className="text-sm text-gray-500">
          Filter by HS code, reporter, partner, year range, and direction.
          Filters sync to the URL for shareable links.
        </p>
      </header>
      <Suspense fallback={<FlowsLoading />}>
        <FlowsBody filter={filter} />
      </Suspense>
    </main>
  );
}
