import {
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  generateSalt,
  generateIV,
  hashPassword,
  hashPasswordForAuth,
  hashPasswordForEncryption
} from '@/utils/cryptography/encryption';

describe('Encryption Utilities', () => {
  describe('hashPassword (legacy)', () => {
    it('should create a deterministic hash from a password', () => {
      const password = 'testPassword123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });
    
    it('should create different hashes for different passwords', () => {
      const password1 = 'testPassword123';
      const password2 = 'testPassword124';
      
      const hash1 = hashPassword(password1);
      const hash2 = hashPassword(password2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashPasswordForAuth', () => {
    it('should create a deterministic hash from a password for authentication', () => {
      const password = 'testPassword123';
      const hash1 = hashPasswordForAuth(password);
      const hash2 = hashPasswordForAuth(password);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });
    
    it('should create different hashes for different passwords', () => {
      const password1 = 'testPassword123';
      const password2 = 'testPassword124';
      
      const hash1 = hashPasswordForAuth(password1);
      const hash2 = hashPasswordForAuth(password2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashPasswordForEncryption', () => {
    it('should create a deterministic hash from a password for encryption', () => {
      const password = 'testPassword123';
      const hash1 = hashPasswordForEncryption(password);
      const hash2 = hashPasswordForEncryption(password);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });
    
    it('should create different hashes for different passwords', () => {
      const password1 = 'testPassword123';
      const password2 = 'testPassword124';
      
      const hash1 = hashPasswordForEncryption(password1);
      const hash2 = hashPasswordForEncryption(password2);
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should create different hashes for auth vs encryption with same password', () => {
      const password = 'testPassword123';
      const authHash = hashPasswordForAuth(password);
      const encryptionHash = hashPasswordForEncryption(password);
      
      expect(authHash).not.toBe(encryptionHash);
    });
  });
  
  describe('deriveKeyFromPassword', () => {
    it('should derive consistent keys from the same password and salt', () => {
      const password = 'testPassword123';
      const salt = 'testSalt123';
      
      const key1 = deriveKeyFromPassword(password, salt);
      const key2 = deriveKeyFromPassword(password, salt);
      
      expect(key1).toBe(key2);
      expect(key1.length).toBeGreaterThan(0);
    });
    
    it('should derive different keys with different salts', () => {
      const password = 'testPassword123';
      const salt1 = 'testSalt123';
      const salt2 = 'testSalt456';
      
      const key1 = deriveKeyFromPassword(password, salt1);
      const key2 = deriveKeyFromPassword(password, salt2);
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('generateSalt and generateIV', () => {
    it('should generate random salt values', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThan(0);
    });
    
    it('should generate random IV values', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      
      expect(iv1).not.toBe(iv2);
      expect(iv1.length).toBeGreaterThan(0);
    });
  });
  
  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = { content: 'Test item', completed: false };
      const password = 'testPassword123';
      const salt = generateSalt();
      const iv = generateIV();
      const key = deriveKeyFromPassword(password, salt);
      
      const encryptedData = encryptData(testData, key, iv);
      
      expect(encryptedData).toBeTruthy();
      expect(typeof encryptedData).toBe('string');
      
      const decryptedData = decryptData(encryptedData, key, iv);
      
      expect(decryptedData).toEqual(testData);
    });
    
    it('should fail to decrypt with an incorrect key', () => {
      const testData = { content: 'Test item', completed: false };
      const password1 = 'testPassword123';
      const password2 = 'incorrectPassword';
      const salt = generateSalt();
      const iv = generateIV();
      
      const key1 = deriveKeyFromPassword(password1, salt);
      const key2 = deriveKeyFromPassword(password2, salt);
      
      const encryptedData = encryptData(testData, key1, iv);
      const decryptedData = decryptData(encryptedData, key2, iv, true); // Silence errors
      
      expect(decryptedData).toBeNull();
    });
    
    it('should fail to decrypt with an invalid IV format', () => {
      const testData = { content: 'Test item', completed: false };
      const password = 'testPassword123';
      const salt = generateSalt();
      const iv1 = generateIV();
      // Using an invalid format for IV that will cause the parsing to fail
      const invalidIv = 'not-a-valid-hex-iv';
      
      const key = deriveKeyFromPassword(password, salt);
      
      const encryptedData = encryptData(testData, key, iv1);
      
      // This should return null because the IV is not valid hex
      const decryptedData = decryptData(encryptedData, key, invalidIv, true); // Silence errors
      
      expect(decryptedData).toBeNull();
    });
  });
});