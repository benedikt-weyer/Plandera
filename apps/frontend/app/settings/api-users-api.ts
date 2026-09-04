'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { clearDecryptedBackend } from '@/utils/api/decrypted-backend';
import {
  decryptJsonWithWrappedDek,
  encryptJsonForRecipients,
  getStoredCryptKey,
  rewrapDekForRecipient,
} from '@/utils/cryptography/encryption';
import type { ApiUser, WrappedDekPayload } from '@/utils/api/types';

/**
 * Picks up a just-created/deleted api user in this tab immediately: the
 * decrypted-backend singleton snapshots the recipients map (who to wrap
 * new/edited records for) once at construction, and the stored session's
 * `linkedPrincipals` is what that snapshot is built from.
 */
async function syncLinkedPrincipalsAfterChange(): Promise<void> {
  const backend = getBackend();
  await backend.auth.refreshLinkedPrincipals?.();
  clearDecryptedBackend();
}

export interface ApiUserWithLabel extends ApiUser {
  label: string;
}

function readStoredSession(): {
  currentPrincipal: { id: string };
  linkedPrincipals: { id: string; latestKekPublicKey: string }[];
} | null {
  try {
    const raw = localStorage.getItem('auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ownerRecipient(): { userId: string; kekPublicKey: string } {
  const session = readStoredSession();
  if (!session) {
    throw new Error('Not signed in.');
  }
  const own = session.linkedPrincipals.find((p) => p.id === session.currentPrincipal.id);
  if (!own) {
    throw new Error('Missing own KEK metadata in the current session.');
  }
  return { userId: own.id, kekPublicKey: own.latestKekPublicKey };
}

export async function listApiUsers(): Promise<ApiUserWithLabel[]> {
  const backend = getBackend();
  const cryptKey = getStoredCryptKey();
  if (!backend.apiUsers || !cryptKey) {
    throw new Error('Not signed in.');
  }

  const response = await backend.apiUsers.list();
  const apiUsers = response.data ?? [];

  return Promise.all(
    apiUsers.map(async (apiUser) => {
      let label = '(unlabeled)';
      try {
        label = await decryptJsonWithWrappedDek<string>(apiUser.encryptedLabel, apiUser.encryptedLabelDek, cryptKey);
      } catch {
        // Leave the placeholder label if this principal's wrap is somehow missing/invalid.
      }
      return { ...apiUser, label };
    }),
  );
}

/** Creates a new API user with a freshly-generated token (returned once, for the caller to display and copy). */
export async function createApiUser(label: string): Promise<{ apiUser: ApiUser; tokenHex: string }> {
  const backend = getBackend();
  if (!backend.apiUsers) {
    throw new Error('This backend does not support API users.');
  }

  const owner = ownerRecipient();
  const apiUserId = crypto.randomUUID();
  const tokenHex = await backend.apiUsers.createApiToken();
  const credentials = await backend.apiUsers.deriveApiTokenCredentials(tokenHex);

  const encryptedLabel = await encryptJsonForRecipients(label, {
    [owner.userId]: owner.kekPublicKey,
    [apiUserId]: credentials.kekKeyPair.kekPublicKey,
  });

  const response = await backend.apiUsers.create({
    apiUserId,
    authKey: credentials.authKey,
    kekPublicKey: credentials.kekKeyPair.kekPublicKey,
    encryptedLabel: {
      algorithm: encryptedLabel.algorithm,
      ciphertext_hex: encryptedLabel.ciphertext_hex,
      nonce_hex: encryptedLabel.nonce_hex,
      version: encryptedLabel.version,
    },
    encryptedLabelDeks: encryptedLabel.wrapped_deks,
  });

  if (!response.data) {
    throw new Error(response.error ?? 'Failed to create api user');
  }

  await syncLinkedPrincipalsAfterChange();

  return { apiUser: response.data, tokenHex };
}

export async function deleteApiUser(id: string): Promise<void> {
  const backend = getBackend();
  if (!backend.apiUsers) {
    throw new Error('This backend does not support API users.');
  }
  const { error } = await backend.apiUsers.delete(id);
  if (error) {
    throw new Error(error);
  }

  await syncLinkedPrincipalsAfterChange();
}

/**
 * Grants an api user access to every resource the owner currently has —
 * rewraps each resource's DEK for the api user's KEK and uploads the new
 * wraps. Existing resources the api user already has a wrap for are
 * re-uploaded harmlessly (upsert).
 */
export async function provisionApiUserAccess(apiUser: ApiUser): Promise<{ provisioned: number }> {
  const backend = getBackend();
  const cryptKey = getStoredCryptKey();
  if (!backend.apiUsers || !cryptKey) {
    throw new Error('Not signed in.');
  }

  const resourceLists = await Promise.all([
    backend.canDoList.getAll(),
    backend.projects.getAll({ all: true }),
    backend.calendars.getAll(),
    backend.calendarEvents.getAll(),
    backend.countdowns.getAll(),
  ]);

  const deks: { resource_id: string; wrapped_dek: WrappedDekPayload }[] = [];

  for (const list of resourceLists) {
    for (const record of list.data) {
      if (!record.wrapped_dek) continue;
      try {
        const wrapped = await rewrapDekForRecipient(
          record,
          record.wrapped_dek,
          cryptKey,
          apiUser.id,
          apiUser.latestKekPublicKey,
        );
        deks.push({ resource_id: record.id, wrapped_dek: wrapped });
      } catch {
        // Skip records this principal can't itself decrypt.
      }
    }
  }

  // User settings is a singleton keyed by the owner's own user id.
  const settings = await backend.userSettings.get();
  if (settings.data?.wrapped_dek) {
    const session = readStoredSession();
    if (session) {
      try {
        const wrapped = await rewrapDekForRecipient(
          settings.data,
          settings.data.wrapped_dek,
          cryptKey,
          apiUser.id,
          apiUser.latestKekPublicKey,
        );
        deks.push({ resource_id: session.currentPrincipal.id, wrapped_dek: wrapped });
      } catch {
        // Skip if this principal can't decrypt its own settings DEK for some reason.
      }
    }
  }

  if (deks.length === 0) {
    return { provisioned: 0 };
  }

  const response = await backend.apiUsers.provisionDeks(apiUser.id, deks);
  if (!response.data) {
    throw new Error(response.error ?? 'Failed to provision api user access');
  }

  return { provisioned: deks.length };
}
