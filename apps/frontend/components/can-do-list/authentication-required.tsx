'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AuthenticationRequiredProps {
  isLoadingKey: boolean;
  encryptionKey: string | null;
}

export default function AuthenticationRequired({ isLoadingKey, encryptionKey }: AuthenticationRequiredProps) {
  if (encryptionKey || isLoadingKey) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
      <p className="text-center mb-4">
        You need to log in first to access your encrypted Can-Do List.
      </p>
      <Link href="/sign-in">
        <Button>Sign In</Button>
      </Link>
    </div>
  );
}
