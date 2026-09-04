import CryptoJS from 'crypto-js';

/**
 * Utility functions for client-side encryption and decryption of can-do list items
 * using a key derived from the user's password
 */

// Generate a key from the user's password and a salt
export const deriveKeyFromPassword = (password: string, salt: string): string => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
};

// Generate a random salt for key derivation
export const generateSalt = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

// Generate a random initialization vector (IV)
export const generateIV = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

// Encrypt data using the derived key and IV
export const encryptData = (data: any, key: string, iv: string): string => {
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return encrypted.toString();
};

// Decrypt data using the derived key and IV
export const decryptData = (encryptedData: string, key: string, iv: string, silenceErrors = false): any => {
  try {
    // Validate IV is a proper hex format
    if (!/^[0-9a-fA-F]+$/.test(iv)) {
      throw new Error('Invalid IV format: must be a hex string');
    }
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!jsonString) {
      throw new Error('Decryption failed: Empty result');
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    if (!silenceErrors) {
      console.error('Decryption failed:', error);
    }
    return null;
  }
};

// Salt for authentication hashing
const AUTH_SALT = 'streamline_auth_salt_2024';

// Salt for encryption key derivation
const ENCRYPTION_SALT = 'streamline_encryption_salt_2024';

// Hash the user's password for authentication
export const hashPasswordForAuth = (password: string): string => {
  return CryptoJS.PBKDF2(password, AUTH_SALT, {
    keySize: 256 / 32,
    iterations: 10000
  }).toString();
};

// Hash the user's password for encryption/decryption key derivation
export const hashPasswordForEncryption = (password: string): string => {
  return CryptoJS.PBKDF2(password, ENCRYPTION_SALT, {
    keySize: 256 / 32,
    iterations: 10000
  }).toString();
};

// Legacy function for backward compatibility - now uses encryption hashing
export const hashPassword = (password: string): string => {
  return hashPasswordForEncryption(password);
};

// Cookie management functions for storing the encryption key
export const storeEncryptionKey = (encryptionKey: string): void => {
  document.cookie = `encKey=${encryptionKey};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
};

export const getStoredEncryptionKey = (): string | null => {
  const match = RegExp(/encKey=([^;]+)/).exec(document.cookie);
  return match ? match[1] : null;
};

export const clearStoredEncryptionKey = (): void => {
  document.cookie = 'encKey=;path=/;max-age=0';
};

// Legacy function names for backward compatibility
export const storeHashedPassword = storeEncryptionKey;
export const getHashedPassword = getStoredEncryptionKey;
export const clearHashedPassword = clearStoredEncryptionKey;