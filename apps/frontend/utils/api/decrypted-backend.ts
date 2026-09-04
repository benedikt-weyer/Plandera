/**
 * Decrypted Backend Utility
 * Provides easy access to the decrypted backend interface
 */

import { DecryptedBackendInterface } from './decrypted-backend-interface';
import { DecryptedBackendImpl } from './decrypted-backend-impl';
import { getBackend } from './backend-interface';
import { getStoredCryptKey } from '../cryptography/encryption';

let decryptedBackendInstance: DecryptedBackendInterface | null = null;

/**
 * Get or create the decrypted backend interface instance
 * @returns DecryptedBackendInterface instance
 * @throws Error if the local crypt key or session is not available
 */
export function getDecryptedBackend(): DecryptedBackendInterface {
  const cryptKey = getStoredCryptKey();
  if (!cryptKey) {
    throw new Error('Encryption key not available. User must be logged in.');
  }

  if (decryptedBackendInstance) {
    return decryptedBackendInstance;
  }

  const recipients = readRecipientsFromStoredSession();
  const backend = getBackend();
  decryptedBackendInstance = new DecryptedBackendImpl(backend, cryptKey, recipients);

  return decryptedBackendInstance;
}

/**
 * principal id -> latest kek public key, for everyone a newly-saved record
 * should be readable by. `linkedPrincipals` already includes the current
 * principal itself (the owner, or an api user, plus every other principal
 * under the same account) — see `list_linked_principals_for_owner` on the
 * backend — so no separate case is needed for "self".
 */
function readRecipientsFromStoredSession(): Record<string, string> {
  try {
    const raw = localStorage.getItem('auth_session');
    if (!raw) {
      return {};
    }
    const session = JSON.parse(raw);
    const recipients: Record<string, string> = {};
    for (const linked of session.linkedPrincipals ?? []) {
      recipients[linked.id] = linked.latestKekPublicKey;
    }
    return recipients;
  } catch {
    return {};
  }
}

/**
 * Clear the decrypted backend instance (useful for logout, or after linking
 * a new API user so the next record save wraps a DEK for it too).
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
