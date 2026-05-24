import {
  getPortOptions,
  getVehicleOptions,
} from "../../src/lib/dashboard/queries";
import { CalculatorForm } from "../_components/CalculatorForm";
import { ErrorState } from "../_components/ErrorState";

export const dynamic = "force-dynamic";

export default function CalculatorPage() {
  let vehicleOptions, portOptions;
  try {
    vehicleOptions = getVehicleOptions();
    portOptions = getPortOptions();
  } catch (err) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Vehicle import calculator
        </h1>
        <ErrorState
          title="Could not load vehicle catalog"
          detail={err instanceof Error ? err.message : "Unknown error"}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vehicle import calculator
        </h1>
        <p className="text-sm text-gray-500">
          Pick a vehicle and lane, get ranked routes with full landed-cost
          breakdown and duty notes.
        </p>
      </header>
      <CalculatorForm
        vehicleOptions={vehicleOptions}
        portOptions={portOptions}
      />
    </main>
  );
}
