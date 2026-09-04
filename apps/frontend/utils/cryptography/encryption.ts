/**
 * Client-side E2EE primitives, backed by the published `@e2ee-lib/e2ee-auth`
 * + `@e2ee-lib/oqs-kek` packages (password-derived credentials, per-record
 * DEKs wrapped with ML-KEM-768 so multiple principals — the owner and any
 * API users — can each be granted their own access to a record).
 */
import {
  createApiToken,
  createPasswordSalt,
  decryptStringWithAsymmetricKek,
  deriveApiTokenCredentials,
  deriveCredentials as e2eeDeriveCredentials,
  deriveKekKeyPair,
  encryptStringWithAsymmetricKeks,
  normalizeEmail,
  rewrapAsymmetricEncryptedDek,
} from '@e2ee-lib/e2ee-auth/web';
import type {
  CryptKey,
  DerivedApiTokenCredentials,
  DerivedCredentials,
  EncryptedPayload,
  KekAsymmetricDekEncryptedPayload,
  KekAsymmetricWrappedPayload,
  KekKeyPair,
} from '@e2ee-lib/e2ee-auth/web';

export type {
  CryptKey,
  DerivedApiTokenCredentials,
  DerivedCredentials,
  EncryptedPayload,
  KekAsymmetricDekEncryptedPayload,
  KekAsymmetricWrappedPayload,
  KekKeyPair,
};

export { createApiToken, createPasswordSalt, deriveApiTokenCredentials, deriveKekKeyPair, normalizeEmail };

export async function deriveCredentials(email: string, password: string, saltHex: string): Promise<DerivedCredentials> {
  return e2eeDeriveCredentials(email, password, saltHex);
}

// --- hex <-> CryptKey -------------------------------------------------

export function cryptKeyToHex(key: CryptKey): string {
  return Array.from(key, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function cryptKeyFromHex(hex: string): CryptKey {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// --- per-record DEK payload for one or more recipients -----------------

/** The shape a resource handler on the backend expects for one recipient's wrap
 * (field names match the Rust `WrappedDekPayload` struct's wire format exactly —
 * it is never camelCase-renamed, even when nested in a camelCase auth request). */
export type WrappedDekPayload = {
  user_id: string;
  kek_public_key: string;
  algorithm: string;
  kem_ciphertext_hex: string;
  wrapped_dek_hex: string;
  nonce_hex: string;
  version: number;
};

export type EncryptedRecordPayload = {
  algorithm: string;
  ciphertext_hex: string;
  nonce_hex: string;
  version: number;
  wrapped_deks: WrappedDekPayload[];
};

/**
 * Encrypts `data` under a fresh DEK and wraps that DEK once per recipient in
 * `recipients` (principal id -> kek public key) — normally just the current
 * principal, or the current principal plus any linked API users.
 */
export async function encryptJsonForRecipients(
  data: unknown,
  recipients: Record<string, string>,
): Promise<EncryptedRecordPayload> {
  const kekIdToUserId = new Map<string, string>();
  for (const [userId, kekPublicKey] of Object.entries(recipients)) {
    kekIdToUserId.set(kekPublicKey.trim().toLowerCase(), userId);
  }

  const { encryptedDeks, encryptedPayload } = await encryptStringWithAsymmetricKeks(
    JSON.stringify(data),
    Object.values(recipients),
  );

  const wrappedDeks: WrappedDekPayload[] = encryptedDeks.map((wrapped) => {
    const userId = kekIdToUserId.get(wrapped.kekPublicKey);
    if (!userId) {
      throw new Error('Unable to map a wrapped DEK back to its recipient.');
    }
    return toWrappedDekPayload(userId, wrapped);
  });

  return {
    algorithm: encryptedPayload.algorithm,
    ciphertext_hex: encryptedPayload.ciphertextHex,
    nonce_hex: encryptedPayload.nonceHex,
    version: encryptedPayload.version,
    wrapped_deks: wrappedDeks,
  };
}

/** Convenience wrapper for the common case of a single recipient. */
export async function encryptJsonForRecipient(
  data: unknown,
  userId: string,
  kekPublicKey: string,
): Promise<EncryptedRecordPayload> {
  return encryptJsonForRecipients(data, { [userId]: kekPublicKey });
}

/**
 * Decrypts a record given its ciphertext fields and this principal's own
 * wrapped DEK (as returned by the backend), using this principal's cryptKey.
 */
export type RecordCiphertext = { algorithm: string; ciphertext_hex: string; nonce_hex: string; version: number };

function toLibraryPayload(record: RecordCiphertext, wrappedDek: WrappedDekPayload): KekAsymmetricDekEncryptedPayload {
  return {
    encryptedDek: {
      algorithm: wrappedDek.algorithm as KekAsymmetricWrappedPayload['algorithm'],
      kemCiphertextHex: wrappedDek.kem_ciphertext_hex,
      kekPublicKey: wrappedDek.kek_public_key,
      nonceHex: wrappedDek.nonce_hex,
      version: wrappedDek.version as KekAsymmetricWrappedPayload['version'],
      wrappedDekHex: wrappedDek.wrapped_dek_hex,
    },
    encryptedPayload: {
      algorithm: record.algorithm as EncryptedPayload['algorithm'],
      ciphertextHex: record.ciphertext_hex,
      nonceHex: record.nonce_hex,
      version: record.version as EncryptedPayload['version'],
    },
  };
}

export async function decryptJsonWithWrappedDek<T>(
  record: RecordCiphertext,
  wrappedDek: WrappedDekPayload,
  cryptKey: CryptKey,
): Promise<T> {
  const json = await decryptStringWithAsymmetricKek(toLibraryPayload(record, wrappedDek), cryptKey);
  return JSON.parse(json) as T;
}

/** Re-wraps an existing wrapped DEK for a newly-linked recipient (e.g. provisioning an API user). */
export async function rewrapDekForRecipient(
  record: RecordCiphertext,
  wrappedDek: WrappedDekPayload,
  cryptKey: CryptKey,
  recipientUserId: string,
  recipientKekPublicKey: string,
): Promise<WrappedDekPayload> {
  const rewrapped = await rewrapAsymmetricEncryptedDek(
    toLibraryPayload(record, wrappedDek),
    cryptKey,
    recipientKekPublicKey,
  );
  return toWrappedDekPayload(recipientUserId, rewrapped);
}

function toWrappedDekPayload(userId: string, wrapped: KekAsymmetricWrappedPayload): WrappedDekPayload {
  return {
    user_id: userId,
    kek_public_key: wrapped.kekPublicKey,
    algorithm: wrapped.algorithm,
    kem_ciphertext_hex: wrapped.kemCiphertextHex,
    wrapped_dek_hex: wrapped.wrappedDekHex,
    nonce_hex: wrapped.nonceHex,
    version: wrapped.version,
  };
}

// --- session persistence (cookie for the crypt key, matching the previous
// single-key cookie pattern) --------------------------------------------

export const storeCryptKey = (cryptKey: CryptKey): void => {
  document.cookie = `cryptKey=${cryptKeyToHex(cryptKey)};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
};

export const getStoredCryptKey = (): CryptKey | null => {
  const match = RegExp(/cryptKey=([^;]+)/).exec(document.cookie);
  return match ? cryptKeyFromHex(match[1]) : null;
};

export const clearStoredCryptKey = (): void => {
  document.cookie = 'cryptKey=;path=/;max-age=0';
};

// --- generic password-protected blob encryption, for the export/import
// "password protected" wrapper file. Unrelated to the account's own E2EE —
// just PBKDF2 + AES-GCM over the whole exported JSON via Web Crypto. -------

export type PasswordProtectedBlob = { ciphertext_hex: string; salt_hex: string; iv_hex: string };

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  return out;
}

async function derivePasswordAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBlobWithPassword(data: unknown, password: string): Promise<PasswordProtectedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePasswordAesKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));

  return { ciphertext_hex: bytesToHex(new Uint8Array(ciphertext)), salt_hex: bytesToHex(salt), iv_hex: bytesToHex(iv) };
}

export async function decryptBlobWithPassword<T>(blob: PasswordProtectedBlob, password: string): Promise<T> {
  const key = await derivePasswordAesKey(password, hexToBytes(blob.salt_hex));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(blob.iv_hex) },
    key,
    hexToBytes(blob.ciphertext_hex),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
};
