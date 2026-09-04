'use client';

interface EmptyStateProps {
  isLoading: boolean;
  itemsLength: number;
}

export default function EmptyState({ isLoading, itemsLength }: EmptyStateProps) {
  if (isLoading || itemsLength > 0) return null;

  return (
    <div className="text-center py-8 text-muted-foreground">
      Your list is empty. Add your first item above!
    </div>
  );
}
