/**
 * Decrypted Backend Utility
 * Provides easy access to the decrypted backend interface
 */

import { DecryptedBackendInterface } from './decrypted-backend-interface';
import { DecryptedBackendImpl } from './decrypted-backend-impl';
import { getBackend } from './backend-interface';
import { getStoredEncryptionKey } from '../cryptography/encryption';

let decryptedBackendInstance: DecryptedBackendInterface | null = null;

/**
 * Get or create the decrypted backend interface instance
 * @returns DecryptedBackendInterface instance
 * @throws Error if encryption key is not available
 */
export function getDecryptedBackend(): DecryptedBackendInterface {
  const encryptionKey = getStoredEncryptionKey();
  if (!encryptionKey) {
    throw new Error('Encryption key not available. User must be logged in.');
  }

  // Return existing instance if available
  if (decryptedBackendInstance) {
    return decryptedBackendInstance;
  }

  // Create new instance
  const backend = getBackend();
  decryptedBackendInstance = new DecryptedBackendImpl(backend, encryptionKey);
  
  return decryptedBackendInstance;
}

/**
 * Clear the decrypted backend instance (useful for logout)
 */
export function clearDecryptedBackend(): void {
  decryptedBackendInstance = null;
}

/**
 * Default export for convenience
 */
export const decryptedBackend = {
  get: () => getDecryptedBackend(),
};
