'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackend } from "@/utils/api/backend-interface";
import { AuthUser } from "@/utils/api/types";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const backend = getBackend();
        const { data: { user: authUser } } = await backend.auth.getUser();
        
        if (!authUser) {
          router.push("/sign-in");
          return;
        }
        
        setUser(authUser);
      } catch (error) {
        console.warn('Backend not initialized in AuthGuard:', error);
        router.push("/sign-in");
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      )
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

export default AuthGuard;
