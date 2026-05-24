import type { CalculatorResultOk } from "../calculator/actions";
import { EmptyState } from "./EmptyState";

export interface RouteBreakdownProps {
  result: CalculatorResultOk;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RouteBreakdown({ result }: RouteBreakdownProps) {
  if (result.routes.length === 0) {
    return (
      <EmptyState
        title="No routes available"
        detail={`No shipping lanes connect ${result.input.originPort} → ${result.input.destinationPort} with current data.`}
      />
    );
  }
  return (
    <section
      aria-label="Calculated route options"
      data-testid="route-breakdown"
      className="space-y-4"
    >
      <ol className="space-y-3">
        {result.routes.map((r, i) => (
          <li
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            data-testid="route-option"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">
                Option {i + 1}
              </span>
              <span className="text-lg font-semibold text-gray-900">
                {formatUsd(r.totalLandedCostUsd)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              ETA {r.etaDays} days · {r.hops.length} leg{r.hops.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              {r.hops.map((h, j) => (
                <li key={j} className="font-mono">
                  {h.fromPort} → {h.toPort} · {h.mode} · {formatUsd(h.rateUsd)}
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
              <div>
                <dt className="uppercase tracking-wide text-gray-400">Shipping</dt>
                <dd className="font-mono text-gray-800">
                  {formatUsd(r.shippingCostUsd)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-gray-400">Duty</dt>
                <dd
                  className="font-mono text-gray-800"
                  data-testid="line-item-duty"
                >
                  {formatUsd(r.dutyUsd)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-gray-400">Broker</dt>
                <dd className="font-mono text-gray-800">
                  {formatUsd(r.brokerFeesUsd)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-gray-400">Total</dt>
                <dd
                  className="font-mono text-gray-900"
                  data-testid="line-item-total"
                >
                  {formatUsd(r.totalLandedCostUsd)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        data-testid="duty-notes"
      >
        <h3 className="text-sm font-semibold text-gray-800">Duty notes</h3>
        <p className="mt-1 text-xs text-gray-500">
          Agreement applied:{" "}
          <span className="font-mono">{result.duty.agreementApplied}</span> · Vehicle age{" "}
          {result.vehicleAgeYears} yr
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
          {result.duty.breakdown.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
