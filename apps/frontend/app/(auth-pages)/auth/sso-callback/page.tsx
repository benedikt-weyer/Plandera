'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { validateSSOToken, retrieveAndClearSSOToken, exchangeSSOToken } from '@/utils/auth/sso-utils';
import { hashPasswordForEncryption, storeEncryptionKey } from '@/utils/cryptography/encryption';

function SSOCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Verifying your Streamline Account...');

  useEffect(() => {
    const handleSSOCallback = async () => {
      try {
        // Get token from URL or session storage
        const tokenFromURL = searchParams.get('token');
        const tokenFromStorage = retrieveAndClearSSOToken();
        const ssoToken = tokenFromURL || tokenFromStorage;

        if (!ssoToken) {
          setError('No authentication token received');
          return;
        }

        setStatus('Validating your session...');
        
        // Validate token with auth server
        const validation = await validateSSOToken(ssoToken);
        
        if (!validation.valid || !validation.user) {
          setError(validation.error || 'Invalid session');
          return;
        }

        setStatus('Setting up encryption...');
        
        // For SSO users, we need to derive an encryption key
        // We'll use the user's ID and email as a basis
        // NOTE: This is a simplified approach. In production, you might want
        // to prompt the user for a master password or use a different key derivation method
        const keyMaterial = `${validation.user.id}-${validation.user.email}-${ssoToken}`;
        const encryptionKey = hashPasswordForEncryption(keyMaterial);
        storeEncryptionKey(encryptionKey);

        setStatus('Connecting to Plandera...');
        
        // Exchange SSO token for scheduler auth token
        const backendURL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL || 'http://localhost:3001';
        const exchange = await exchangeSSOToken(ssoToken, backendURL);
        
        if (exchange.error || !exchange.token) {
          setError(exchange.error || 'Failed to authenticate with Plandera');
          return;
        }

        // Store the scheduler auth token
        localStorage.setItem('auth_token', exchange.token);
        
        setStatus('Success! Redirecting...');
        
        // Small delay before redirect to show success message
        setTimeout(() => {
          router.push('/home');
        }, 500);
      } catch (err) {
        console.error('SSO callback error:', err);
        setError('An unexpected error occurred during authentication');
      }
    };

    handleSSOCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-destructive/50 bg-card p-8 text-center shadow-lg">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Authentication Failed</h1>
          <p className="mb-6 text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg">
        <div className="mb-6 flex justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Signing you in</h1>
        <p className="text-muted-foreground">{status}</p>
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full animate-pulse bg-primary" style={{ width: '70%' }} />
        </div>
      </div>
    </div>
  );
}

export default function SSOCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <SSOCallbackContent />
    </Suspense>
  );
}

