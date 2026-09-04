'use client';

interface LoadingStateProps {
  isLoading: boolean;
}

export default function LoadingState({ isLoading }: LoadingStateProps) {
  if (!isLoading) return null;

  return (
    <div className="text-center py-8">
      Loading your encrypted list...
    </div>
  );
}
