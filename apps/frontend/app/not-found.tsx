'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-6 text-center">
        The requested route could not be found.
      </p>
      
      <div className="bg-muted p-4 rounded-lg mb-6 max-w-2xl w-full">
        <p className="text-sm font-mono break-all">
          <span className="text-muted-foreground">Current route:</span> <span className="text-foreground font-semibold">{pathname || '/'}</span>
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/">
          <Button variant="default">
            Go Home
          </Button>
        </Link>
        <Link href="/sign-in">
          <Button variant="outline">
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}

