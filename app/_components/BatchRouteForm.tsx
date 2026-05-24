"use client";

import { useMemo, useState, useTransition } from "react";
import {
  parseBatchCsv,
  batchResultToCsv,
  SAMPLE_CSV,
} from "../../src/lib/dashboard/batch-csv";
import {
  runBatch,
  type BatchResult,
  type BatchResultRow,
} from "../routes/actions";
import { BATCH_MAX } from "../routes/constants";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BatchRouteForm() {
  const [text, setText] = useState<string>(SAMPLE_CSV);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((next) => setText(next));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setParseErrors([]);
    setResult(null);
    const parsed = parseBatchCsv(text);
    setParseErrors(parsed.errors);
    setTruncated(parsed.truncated);
    if (parsed.rows.length === 0) {
      return;
    }
    startTransition(async () => {
      const next = await runBatch(parsed.rows);
      setResult(next);
    });
  }

  const csvBlob = useMemo(() => {
    if (!result || !result.ok) return null;
    const csv = batchResultToCsv(result.rows);
    return URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
  }, [result]);

  return (
    <div className="space-y-6" data-testid="batch-route">
      <form
        aria-label="Batch route optimizer"
        data-testid="batch-form"
        onSubmit={submit}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Paste rows or upload a CSV (max {BATCH_MAX} vehicles).
          </p>
          <label className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFile}
              data-testid="batch-upload"
            />
          </label>
        </div>
        <textarea
          name="csv"
          aria-label="CSV input"
          data-testid="batch-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
        />
        <p className="text-xs text-gray-500">
          Columns:{" "}
          <code className="font-mono">
            label,hs,ageYears,value,origin,destination
          </code>
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Computing routes…" : "Compute cheapest routes"}
        </button>
      </form>

      {parseErrors.length > 0 ? (
        <ErrorState
          title="Could not parse CSV"
          detail={parseErrors.slice(0, 5).join("; ")}
        />
      ) : null}
      {truncated ? (
        <ErrorState
          title="Input truncated"
          detail={`Only the first ${BATCH_MAX} rows were used.`}
        />
      ) : null}

      {result && !result.ok ? (
        <ErrorState title="Batch failed" detail={result.message} />
      ) : null}

      {result && result.ok ? (
        <BatchResults result={result} csvBlob={csvBlob} />
      ) : null}
    </div>
  );
}

function BatchResults({
  result,
  csvBlob,
}: {
  result: Extract<BatchResult, { ok: true }>;
  csvBlob: string | null;
}) {
  if (result.rows.length === 0) {
    return <EmptyState title="No rows processed" />;
  }
  return (
    <section className="space-y-4" data-testid="batch-results">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {result.rows.length} vehicles · Total landed cost{" "}
            <span className="font-mono text-gray-900">
              {formatUsd(result.totalLandedCostUsd)}
            </span>
          </p>
          {result.consolidations.length > 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              {result.consolidations.length} lane
              {result.consolidations.length === 1 ? "" : "s"} with consolidation
              opportunities
            </p>
          ) : null}
        </div>
        <a
          href={csvBlob ?? "#"}
          download="cargrid-batch-results.csv"
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          data-testid="batch-export"
          aria-disabled={!csvBlob}
        >
          Export CSV
        </a>
      </div>

      {result.consolidations.length > 0 ? (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
          data-testid="consolidation-list"
        >
          <h3 className="font-semibold">Consolidation opportunities</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {result.consolidations.map((c) => (
              <li key={`${c.originPort}-${c.destinationPort}`} className="font-mono">
                {c.originPort} → {c.destinationPort}: {c.vehicleCount} vehicles ·{" "}
                {formatUsd(c.totalLandedCostUsd)} combined
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm" data-testid="batch-table">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Lane</th>
              <th className="px-4 py-2 text-right">Shipping</th>
              <th className="px-4 py-2 text-right">Duty</th>
              <th className="px-4 py-2 text-right">Broker</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.rows.map((r, i) => (
              <Row key={i} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ row }: { row: BatchResultRow }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-gray-700">{row.input.vehicleLabel}</td>
      <td className="px-4 py-2 font-mono text-gray-600">
        {row.input.originPort} → {row.input.destinationPort}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {row.best ? formatUsd(row.best.shippingCostUsd) : "—"}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {row.best ? formatUsd(row.best.dutyUsd) : "—"}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {row.best ? formatUsd(row.best.brokerFeesUsd) : "—"}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {row.best ? formatUsd(row.best.totalLandedCostUsd) : "—"}
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">
        {row.best ? "ok" : (row.errorMessage ?? "no route")}
      </td>
    </tr>
  );
}
