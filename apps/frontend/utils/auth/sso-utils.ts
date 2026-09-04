/**
 * SSO (Single Sign-On) utilities for Streamline Account integration
 */

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
const SSO_TOKEN_KEY = 'streamline_sso_token';

export interface SSOUser {
  id: string;
  name: string;
  email: string;
}

export interface SSOValidationResponse {
  valid: boolean;
  user?: SSOUser;
  error?: string;
}

/**
 * Check if SSO is enabled
 */
export function isSSOEnabled(): boolean {
  return !!AUTH_SERVER_URL;
}

/**
 * Get the auth server URL
 */
export function getAuthServerURL(): string | undefined {
  return AUTH_SERVER_URL;
}

/**
 * Redirect user to Streamline Account login
 */
export function redirectToSSOLogin(): void {
  if (!AUTH_SERVER_URL) {
    console.error('SSO is not configured');
    return;
  }

  // Get the current origin for callback
  const callbackURL = encodeURIComponent(
    `${window.location.origin}/auth/sso-callback`
  );

  // Redirect to auth server login with callback URL
  window.location.href = `${AUTH_SERVER_URL}/login?callback=${callbackURL}&app=scheduler`;
}

/**
 * Store SSO token temporarily (during callback flow)
 */
export function storeSSOToken(token: string): void {
  try {
    sessionStorage.setItem(SSO_TOKEN_KEY, token);
  } catch (e) {
    console.error('Failed to store SSO token:', e);
  }
}

/**
 * Retrieve and clear SSO token
 */
export function retrieveAndClearSSOToken(): string | null {
  try {
    const token = sessionStorage.getItem(SSO_TOKEN_KEY);
    if (token) {
      sessionStorage.removeItem(SSO_TOKEN_KEY);
    }
    return token;
  } catch (e) {
    console.error('Failed to retrieve SSO token:', e);
    return null;
  }
}

/**
 * Validate SSO token with auth server
 */
export async function validateSSOToken(token: string): Promise<SSOValidationResponse> {
  if (!AUTH_SERVER_URL) {
    return { valid: false, error: 'SSO not configured' };
  }

  try {
    const response = await fetch(`${AUTH_SERVER_URL}/api/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();
    return data as SSOValidationResponse;
  } catch (error) {
    console.error('Failed to validate SSO token:', error);
    return { valid: false, error: 'Failed to validate session' };
  }
}

/**
 * Exchange SSO token for scheduler auth token
 * This requires backend support
 */
export async function exchangeSSOToken(
  ssoToken: string,
  backendURL: string
): Promise<{ token?: string; error?: string }> {
  try {
    // Validate SSO token first
    const validation = await validateSSOToken(ssoToken);
    
    if (!validation.valid || !validation.user) {
      return { error: validation.error || 'Invalid SSO token' };
    }

    // Exchange with scheduler backend
    // This endpoint needs to be implemented in the Rust backend
    const response = await fetch(`${backendURL}/auth/sso-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sso_token: ssoToken,
        user: validation.user,
      }),
    });

    if (!response.ok) {
      return { error: 'Failed to exchange SSO token' };
    }

    const data = await response.json();
    return { token: data.token };
  } catch (error) {
    console.error('Failed to exchange SSO token:', error);
    return { error: 'SSO exchange failed' };
  }
}

