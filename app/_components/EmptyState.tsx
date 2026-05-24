export interface EmptyStateProps {
  title: string;
  detail?: string;
}

export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600"
      data-testid="empty-state"
    >
      <p className="font-medium text-gray-800">{title}</p>
      {detail ? <p className="mt-1">{detail}</p> : null}
    </div>
  );
}
