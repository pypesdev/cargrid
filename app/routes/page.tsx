import { BatchRouteForm } from "../_components/BatchRouteForm";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Batch route optimizer
        </h1>
        <p className="text-sm text-gray-500">
          Paste vehicle rows or upload a CSV. We compute the cheapest route per
          vehicle, surface consolidation lanes, and export results to CSV.
        </p>
      </header>
      <BatchRouteForm />
    </main>
  );
}
