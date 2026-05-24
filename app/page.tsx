export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">cargrid</h1>
      <p className="mt-4 text-sm text-gray-600">
        No data yet. Run <code>pnpm ingest:seed</code> to populate the local
        SQLite database.
      </p>
    </main>
  );
}
