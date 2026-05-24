import type { FlowRow } from "../../src/lib/dashboard/queries";
import { EmptyState } from "./EmptyState";

export interface FlowsTableProps {
  rows: FlowRow[];
  total: number;
  limit: number;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function FlowsTable({ rows, total, limit }: FlowsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No flows match your filters"
        detail="Try widening the year range or clearing partner/HS code filters."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm" data-testid="flows-table">
        <caption className="bg-gray-50 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          {formatNumber(rows.length)} of {formatNumber(total)} rows
          {total > limit ? ` — showing the first ${limit}` : ""}
        </caption>
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th scope="col" className="px-4 py-2">
              Year-Mo
            </th>
            <th scope="col" className="px-4 py-2">
              Reporter
            </th>
            <th scope="col" className="px-4 py-2">
              Partner
            </th>
            <th scope="col" className="px-4 py-2">
              HS
            </th>
            <th scope="col" className="px-4 py-2">
              Direction
            </th>
            <th scope="col" className="px-4 py-2 text-right">
              Value (USD)
            </th>
            <th scope="col" className="px-4 py-2 text-right">
              Quantity
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr
              key={`${r.reporter}-${r.partner}-${r.hsCode}-${r.year}-${r.month}-${r.flowDirection}-${i}`}
              className="hover:bg-gray-50"
            >
              <td className="px-4 py-2 font-mono text-gray-700">
                {r.year}-{String(r.month).padStart(2, "0")}
              </td>
              <td className="px-4 py-2">{r.reporter}</td>
              <td className="px-4 py-2">{r.partner}</td>
              <td className="px-4 py-2 font-mono text-gray-600">{r.hsCode}</td>
              <td className="px-4 py-2 capitalize text-gray-600">
                {r.flowDirection}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {formatUsd(r.valueUsd)}
              </td>
              <td className="px-4 py-2 text-right text-gray-600">
                {formatNumber(r.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
