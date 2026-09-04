/**
 * Initialize the backend implementation
 * This should be called once at app startup
 */

import { initializeBackend } from './backend-interface';
import RustBackendImpl from './rust-backend-impl';

function getDefaultBackendUrls(): { httpUrl: string; wsUrl: string } {
  if (typeof window === 'undefined') {
    return {
      httpUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
    };
  }

  const { hostname, origin, protocol, host } = window.location;
  const isLocalDevelopment =
    hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalDevelopment) {
    return {
      httpUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
    };
  }

  return {
    httpUrl: origin,
    wsUrl: `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`,
  };
}

// Initialize immediately with safe defaults so getBackend() never throws.
// In production-like environments, default to the current origin instead of localhost.
// Runtime config from /api/config can still override these values afterwards.
const defaultUrls = getDefaultBackendUrls();
const rustBackend = new RustBackendImpl(defaultUrls.httpUrl, defaultUrls.wsUrl);
initializeBackend(rustBackend);

// Fetch runtime config and update URLs before any user interaction occurs.
if (typeof window !== 'undefined') {
  const runtimeConfigPromise = fetch('/api/config')
    .then((res) => res.json())
    .then((config) => {
      console.log('[init] Runtime config loaded:', config);
      rustBackend.updateUrls(config.backendHttpUrl, config.backendWsUrl);
    })
    .catch((err) => {
      console.warn('[init] Failed to fetch runtime config, using defaults:', err);
    });

  rustBackend.setRuntimeConfigPromise(runtimeConfigPromise);
}

export { rustBackend };
