import { useState, useEffect } from 'react';
import { getStoredEncryptionKey, clearStoredEncryptionKey } from '@/utils/cryptography/encryption';
import { getBackend, BackendInterface } from '@/utils/api/backend-interface';

export function useEncryptionKey() {
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[useEncryptionKey] Hook initialized');
    
    let backend: BackendInterface;
    try {
      backend = getBackend();
    } catch (error) {
      console.error('[useEncryptionKey] Backend not initialized:', error);
      setIsLoading(false);
      return;
    }
    
    async function loadEncryptionKey() {
      console.log('[useEncryptionKey] Loading initial encryption key...');
      try {
        // Add a small delay to ensure cookies are properly hydrated
        console.log('[useEncryptionKey] Waiting for cookie hydration...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[useEncryptionKey] Getting session from backend...');
        const { data: { session }, error } = await backend.auth.getSession();
        
        console.log('[useEncryptionKey] Session data:', {
          session: session ? {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: session.expires_at,
            accessToken: session.access_token ? 'present' : 'missing'
          } : null,
          error: error
        });
        
        // Also try getUser() as an alternative
        console.log('[useEncryptionKey] Also trying getUser() as alternative...');
        const { data: { user }, error: userError } = await backend.auth.getUser();
        console.log('[useEncryptionKey] User data:', {
          user: user ? {
            userId: user.id,
            email: user.email,
            createdAt: user.created_at
          } : null,
          userError: userError
        });
        
        // Use session if available, otherwise try user
        const finalSession = session;
        const finalUser = session?.user || user;
        
        if (finalSession || finalUser) {
          console.log('[useEncryptionKey] User is authenticated, checking for stored encryption key...');
          
          // Get the stored encryption key from cookies
          const storedKey = getStoredEncryptionKey();
          console.log('[useEncryptionKey] Stored encryption key:', storedKey ? 'present' : 'missing');
          
          if (storedKey) {
            setEncryptionKey(storedKey);
            console.log('[useEncryptionKey] Encryption key loaded from storage');
          } else {
            console.warn('[useEncryptionKey] No stored encryption key found - user may need to sign in again');
            setEncryptionKey(null);
          }
        } else {
          // No session, clear the encryption key
          console.log('[useEncryptionKey] No session or user found, clearing encryption key');
          setEncryptionKey(null);
        }
      } catch (error) {
        console.error('[useEncryptionKey] Error getting encryption key:', error);
        setEncryptionKey(null);
      } finally {
        console.log('[useEncryptionKey] Initial loading complete, setting isLoading to false');
        setIsLoading(false);
      }
    }
    
    // Load initial encryption key
    loadEncryptionKey();

    // Listen for authentication state changes
    console.log('[useEncryptionKey] Setting up auth state change listener...');
    const { data: { subscription } } = backend.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useEncryptionKey] Auth state changed:', event, session ? `session exists (user: ${session.user.id})` : 'no session');
        
        if (event === 'SIGNED_IN' && session) {
          // User signed in, check for stored encryption key
          console.log('[useEncryptionKey] SIGNED_IN event - checking for stored encryption key');
          const storedKey = getStoredEncryptionKey();
          if (storedKey) {
            setEncryptionKey(storedKey);
            console.log('[useEncryptionKey] Encryption key loaded from storage after sign in');
          } else {
            console.warn('[useEncryptionKey] No stored encryption key found after sign in');
            setEncryptionKey(null);
          }
        } else if (event === 'SIGNED_OUT') {
          // User signed out, clear encryption key
          console.log('[useEncryptionKey] SIGNED_OUT event - clearing encryption key');
          clearStoredEncryptionKey();
          setEncryptionKey(null);
          console.log('[useEncryptionKey] Encryption key cleared');
        } else if (event === 'INITIAL_SESSION') {
          // Initial session check - handle like a session state
          console.log('[useEncryptionKey] INITIAL_SESSION event - checking for existing session');
          if (session) {
            console.log('[useEncryptionKey] INITIAL_SESSION with session - checking for stored encryption key');
            const storedKey = getStoredEncryptionKey();
            if (storedKey) {
              setEncryptionKey(storedKey);
              console.log('[useEncryptionKey] Encryption key loaded from storage during initial session');
            } else {
              console.warn('[useEncryptionKey] No stored encryption key found during initial session');
              setEncryptionKey(null);
            }
          } else {
            console.log('[useEncryptionKey] INITIAL_SESSION with no session - clearing encryption key');
            setEncryptionKey(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token refreshed, ensure we still have the encryption key
          console.log('[useEncryptionKey] TOKEN_REFRESHED event - checking encryption key');
          console.log('[useEncryptionKey] Current encryptionKey state:', encryptionKey ? 'present' : 'null');
          if (!encryptionKey) {
            console.log('[useEncryptionKey] Restoring encryption key after token refresh');
            const storedKey = getStoredEncryptionKey();
            if (storedKey) {
              setEncryptionKey(storedKey);
              console.log('[useEncryptionKey] Encryption key restored after token refresh');
            } else {
              console.warn('[useEncryptionKey] No stored encryption key found after token refresh');
            }
          } else {
            console.log('[useEncryptionKey] Encryption key already present, no action needed');
          }
        } else {
          console.log('[useEncryptionKey] Unhandled auth event:', event);
        }
        console.log('[useEncryptionKey] Setting isLoading to false after auth state change');
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('[useEncryptionKey] Cleaning up auth state change subscription');
      subscription.unsubscribe();
      console.log('[useEncryptionKey] Hook cleanup complete');
    };
  }, [encryptionKey]); // Add encryptionKey as dependency for TOKEN_REFRESHED handling

  console.log('[useEncryptionKey] Returning state - encryptionKey:', encryptionKey ? 'present' : 'null', ', isLoading:', isLoading);
  return { encryptionKey, isLoading };
}
