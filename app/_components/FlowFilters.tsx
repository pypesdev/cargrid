"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FlowsResult } from "../../src/lib/dashboard/queries";

export interface FlowFiltersProps {
  filterOptions: FlowsResult["filterOptions"];
  initial: {
    hsCode?: string;
    reporter?: string;
    partner?: string;
    yearFrom?: number;
    yearTo?: number;
    flowDirection?: "import" | "export";
  };
}

function buildQuery(input: FlowFiltersProps["initial"]): string {
  const params = new URLSearchParams();
  if (input.hsCode) params.set("hs", input.hsCode);
  if (input.reporter) params.set("reporter", input.reporter);
  if (input.partner) params.set("partner", input.partner);
  if (input.yearFrom !== undefined)
    params.set("yearFrom", String(input.yearFrom));
  if (input.yearTo !== undefined) params.set("yearTo", String(input.yearTo));
  if (input.flowDirection) params.set("direction", input.flowDirection);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function FlowFilters({ filterOptions, initial }: FlowFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FlowFiltersProps["initial"]>(initial);

  function apply(next: FlowFiltersProps["initial"]) {
    setState(next);
    startTransition(() => {
      router.replace(`/flows${buildQuery(next)}`, { scroll: false });
    });
  }

  function reset() {
    apply({});
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    apply(state);
  }

  return (
    <form
      aria-label="Flow filters"
      data-testid="flow-filters"
      className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-6"
      onSubmit={onSubmit}
    >
      <Field label="HS code" htmlFor="hs">
        <select
          id="hs"
          name="hs"
          value={state.hsCode ?? ""}
          onChange={(e) =>
            setState((s) => ({ ...s, hsCode: e.target.value || undefined }))
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {filterOptions.hsCodes.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reporter" htmlFor="reporter">
        <select
          id="reporter"
          name="reporter"
          value={state.reporter ?? ""}
          onChange={(e) =>
            setState((s) => ({ ...s, reporter: e.target.value || undefined }))
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {filterOptions.reporters.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Partner" htmlFor="partner">
        <select
          id="partner"
          name="partner"
          value={state.partner ?? ""}
          onChange={(e) =>
            setState((s) => ({ ...s, partner: e.target.value || undefined }))
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {filterOptions.partners.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Year from" htmlFor="yearFrom">
        <select
          id="yearFrom"
          name="yearFrom"
          value={state.yearFrom ?? ""}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              yearFrom: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Any</option>
          {filterOptions.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Year to" htmlFor="yearTo">
        <select
          id="yearTo"
          name="yearTo"
          value={state.yearTo ?? ""}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              yearTo: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Any</option>
          {filterOptions.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Direction" htmlFor="direction">
        <select
          id="direction"
          name="direction"
          value={state.flowDirection ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setState((s) => ({
              ...s,
              flowDirection:
                value === "import" || value === "export" ? value : undefined,
            }));
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Both</option>
          <option value="import">Import</option>
          <option value="export">Export</option>
        </select>
      </Field>
      <div className="col-span-full flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Applying…" : "Apply filters"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Reset
        </button>
        {isPending ? (
          <span className="text-xs text-gray-500" role="status">
            Updating…
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-xs text-gray-600">
      <span className="font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
