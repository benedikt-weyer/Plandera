/**
 * @jest-environment node
 *
 * The e2ee-auth/libsodium stack constructs typed arrays that must be
 * `instanceof` the same realm's Uint8Array the crypto library checks
 * against; jsdom's testEnvironment runs test code in a separate VM
 * context with its own globals, so this file opts into the plain node
 * environment instead (it has no DOM dependency anyway).
 */
import {
  createPasswordSalt,
  cryptKeyFromHex,
  cryptKeyToHex,
  decryptBlobWithPassword,
  decryptJsonWithWrappedDek,
  deriveCredentials,
  deriveKekKeyPair,
  encryptBlobWithPassword,
  encryptJsonForRecipients,
} from '@/utils/cryptography/encryption';

describe('E2EE crypto utilities', () => {
  describe('deriveCredentials', () => {
    it('derives the same authKey/cryptKey for the same email/password/salt', async () => {
      const saltHex = await createPasswordSalt();
      const a = await deriveCredentials('user@example.com', 'correct horse battery staple', saltHex);
      const b = await deriveCredentials('USER@example.com  ', 'correct horse battery staple', saltHex);

      expect(a.authKey).toBe(b.authKey);
      expect(cryptKeyToHex(a.cryptKey)).toBe(cryptKeyToHex(b.cryptKey));
      expect(a.email).toBe('user@example.com');
    });

    it('derives different credentials for a different password', async () => {
      const saltHex = await createPasswordSalt();
      const a = await deriveCredentials('user@example.com', 'password one', saltHex);
      const b = await deriveCredentials('user@example.com', 'password two', saltHex);

      expect(a.authKey).not.toBe(b.authKey);
    });
  });

  describe('cryptKeyToHex / cryptKeyFromHex', () => {
    it('round-trips a crypt key through hex', async () => {
      const saltHex = await createPasswordSalt();
      const { cryptKey } = await deriveCredentials('user@example.com', 'a password', saltHex);

      const hex = cryptKeyToHex(cryptKey);
      const restored = cryptKeyFromHex(hex);

      expect(cryptKeyToHex(restored)).toBe(hex);
    });
  });

  describe('per-record DEK encryption (multi-recipient)', () => {
    it('encrypts once and lets every recipient decrypt with their own cryptKey', async () => {
      const ownerSalt = await createPasswordSalt();
      const owner = await deriveCredentials('owner@example.com', 'owner password', ownerSalt);
      const ownerKek = await deriveKekKeyPair(owner.cryptKey);

      const apiUserSalt = await createPasswordSalt();
      const apiUser = await deriveCredentials('api-user@example.com', 'a random api token', apiUserSalt);
      const apiUserKek = await deriveKekKeyPair(apiUser.cryptKey);

      const payload = await encryptJsonForRecipients(
        { content: 'secret task', completed: false },
        { [owner.email]: ownerKek.kekPublicKey, [apiUser.email]: apiUserKek.kekPublicKey },
      );

      expect(payload.wrapped_deks).toHaveLength(2);

      const ownerWrap = payload.wrapped_deks.find((w) => w.user_id === owner.email)!;
      const apiUserWrap = payload.wrapped_deks.find((w) => w.user_id === apiUser.email)!;

      const ownerView = await decryptJsonWithWrappedDek<{ content: string; completed: boolean }>(
        payload,
        ownerWrap,
        owner.cryptKey,
      );
      const apiUserView = await decryptJsonWithWrappedDek<{ content: string; completed: boolean }>(
        payload,
        apiUserWrap,
        apiUser.cryptKey,
      );

      expect(ownerView).toEqual({ content: 'secret task', completed: false });
      expect(apiUserView).toEqual({ content: 'secret task', completed: false });
    });

    it('fails to decrypt with the wrong recipient wrap', async () => {
      const ownerSalt = await createPasswordSalt();
      const owner = await deriveCredentials('owner2@example.com', 'owner password', ownerSalt);
      const ownerKek = await deriveKekKeyPair(owner.cryptKey);

      const strangerSalt = await createPasswordSalt();
      const stranger = await deriveCredentials('stranger@example.com', 'stranger password', strangerSalt);

      const payload = await encryptJsonForRecipients({ secret: true }, { [owner.email]: ownerKek.kekPublicKey });
      const ownerWrap = payload.wrapped_deks[0];

      await expect(decryptJsonWithWrappedDek(payload, ownerWrap, stranger.cryptKey)).rejects.toThrow();
    });
  });

  describe('encryptBlobWithPassword / decryptBlobWithPassword', () => {
    it('round-trips an arbitrary JSON blob under a password', async () => {
      const data = { hello: 'world', numbers: [1, 2, 3] };
      const blob = await encryptBlobWithPassword(data, 'export password');

      const decrypted = await decryptBlobWithPassword<typeof data>(blob, 'export password');
      expect(decrypted).toEqual(data);
    });

    it('fails to decrypt with the wrong password', async () => {
      const blob = await encryptBlobWithPassword({ a: 1 }, 'right password');
      await expect(decryptBlobWithPassword(blob, 'wrong password')).rejects.toThrow();
    });
  });
});
