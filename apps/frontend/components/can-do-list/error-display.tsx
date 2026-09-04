'use client';

interface ErrorDisplayProps {
  error: string | null;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
      {error}
    </div>
  );
}
