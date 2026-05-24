import type { CorridorStat } from "../../src/lib/analysis/flow_aggregations";
import { EmptyState } from "./EmptyState";

export interface TopCorridorsTableProps {
  corridors: CorridorStat[];
  year: number | null;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function TopCorridorsTable({ corridors, year }: TopCorridorsTableProps) {
  if (corridors.length === 0) {
    return (
      <EmptyState
        title="No corridor data yet"
        detail="Run pnpm ingest:seed to populate trade flows."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table
        className="w-full divide-y divide-gray-200 text-sm"
        data-testid="top-corridors-table"
      >
        <caption className="bg-gray-50 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          Top 10 corridors {year ? `(${year})` : ""}
        </caption>
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th scope="col" className="px-4 py-2">
              #
            </th>
            <th scope="col" className="px-4 py-2">
              Reporter
            </th>
            <th scope="col" className="px-4 py-2">
              Partner
            </th>
            <th scope="col" className="px-4 py-2 text-right">
              Total value
            </th>
            <th scope="col" className="px-4 py-2 text-right">
              Months
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {corridors.map((c, i) => (
            <tr key={`${c.reporter}-${c.partner}`} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-500">{i + 1}</td>
              <td className="px-4 py-2 font-medium text-gray-900">
                {c.reporter}
              </td>
              <td className="px-4 py-2 text-gray-700">{c.partner}</td>
              <td className="px-4 py-2 text-right font-mono text-gray-900">
                {formatUsd(c.totalValueUsd)}
              </td>
              <td className="px-4 py-2 text-right text-gray-500">
                {c.monthCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
