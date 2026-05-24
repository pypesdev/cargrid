"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  PortOption,
  VehicleOption,
} from "../../src/lib/dashboard/queries";
import {
  runCalculator,
  type CalculatorResult,
} from "../calculator/actions";
import { ErrorState } from "./ErrorState";
import { RouteBreakdown } from "./RouteBreakdown";

export interface CalculatorFormProps {
  vehicleOptions: VehicleOption[];
  portOptions: PortOption[];
  initial?: {
    vehicleKey?: string;
    declaredValueUsd?: number;
    originPort?: string;
    destinationPort?: string;
  };
}

const KEY_DELIM = "::";

function vehicleKey(v: VehicleOption): string {
  return [v.make, v.model, v.year, v.hsCode].join(KEY_DELIM);
}

export function CalculatorForm({
  vehicleOptions,
  portOptions,
  initial,
}: CalculatorFormProps) {
  const [vKey, setVKey] = useState(initial?.vehicleKey ?? "");
  const [value, setValue] = useState<string>(
    initial?.declaredValueUsd ? String(initial.declaredValueUsd) : "35000",
  );
  const originDefault =
    initial?.originPort ?? portOptions.find((p) => p.role !== "origin")?.port ?? "";
  const destDefault =
    initial?.destinationPort ??
    portOptions.find((p) => p.role !== "destination" && p.port !== originDefault)
      ?.port ??
    "";
  const [originPort, setOriginPort] = useState(originDefault);
  const [destinationPort, setDestinationPort] = useState(destDefault);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selected = useMemo(
    () => vehicleOptions.find((v) => vehicleKey(v) === vKey) ?? null,
    [vehicleOptions, vKey],
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    if (!selected) {
      setValidationError("Pick a vehicle from the list.");
      return;
    }
    const declaredValueUsd = Number(value);
    if (!Number.isFinite(declaredValueUsd) || declaredValueUsd <= 0) {
      setValidationError("Declared value must be greater than 0.");
      return;
    }
    if (!originPort || !destinationPort) {
      setValidationError("Pick both origin and destination ports.");
      return;
    }
    if (originPort === destinationPort) {
      setValidationError("Origin and destination must differ.");
      return;
    }

    startTransition(async () => {
      const next = await runCalculator({
        make: selected.make,
        model: selected.model,
        year: selected.year,
        hsCode: selected.hsCode,
        declaredValueUsd,
        originPort,
        destinationPort,
      });
      setResult(next);
    });
  }

  return (
    <div className="space-y-6" data-testid="calculator">
      <form
        aria-label="Vehicle import cost calculator"
        data-testid="calculator-form"
        onSubmit={submit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <Field label="Vehicle" htmlFor="vehicle">
          <input
            id="vehicle"
            list="vehicle-options"
            value={vKey}
            onChange={(e) => setVKey(e.target.value)}
            placeholder="Type to search…"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            autoComplete="off"
          />
          <datalist id="vehicle-options">
            {vehicleOptions.map((v) => (
              <option key={vehicleKey(v)} value={vehicleKey(v)}>
                {v.label} · HS {v.hsCode}
              </option>
            ))}
          </datalist>
          {selected ? (
            <span className="text-xs text-gray-500">
              {selected.label} · HS {selected.hsCode}
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {vehicleOptions.length} vehicles available
            </span>
          )}
        </Field>
        <Field label="Declared value (USD)" htmlFor="declaredValue">
          <input
            id="declaredValue"
            type="number"
            min="1"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </Field>
        <Field label="Origin port" htmlFor="originPort">
          <select
            id="originPort"
            value={originPort}
            onChange={(e) => setOriginPort(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select…</option>
            {portOptions.map((p) => (
              <option key={`o-${p.port}`} value={p.port}>
                {p.port}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination port" htmlFor="destPort">
          <select
            id="destPort"
            value={destinationPort}
            onChange={(e) => setDestinationPort(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select…</option>
            {portOptions.map((p) => (
              <option key={`d-${p.port}`} value={p.port}>
                {p.port}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Calculating…" : "Calculate"}
          </button>
        </div>
      </form>

      {validationError ? (
        <ErrorState title="Check the form" detail={validationError} />
      ) : null}

      {result && !result.ok ? (
        <ErrorState
          title="Calculation could not complete"
          detail={result.message}
        />
      ) : null}

      {result && result.ok ? <RouteBreakdown result={result} /> : null}
    </div>
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
