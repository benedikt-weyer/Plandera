import { 
  generateSalt, 
  generateIV, 
  deriveKeyFromPassword, 
  encryptData,
  decryptData
} from '@/utils/cryptography/encryption';

/**
 * Encrypts event data for storage
 */
export const encryptEventData = (eventData: any, key: string) => {
  const salt = generateSalt();
  const iv = generateIV();
  const derivedKey = deriveKeyFromPassword(key, salt);
  const encryptedData = encryptData(eventData, derivedKey, iv);
  
  return { encryptedData, salt, iv };
};

/**
 * Decrypts event data from storage
 */
export const decryptEventData = (encryptedData: string, key: string, salt: string, iv: string) => {
  const derivedKey = deriveKeyFromPassword(key, salt);
  return decryptData(encryptedData, derivedKey, iv);
};
