import { isValid } from 'date-fns';

/**
 * Validates that required event data is present
 */
export const validateEventData = (eventData: any): boolean => {
  if (!eventData) return false;
  if (!eventData.title?.trim()) return false;
  if (!eventData.startTime || !eventData.endTime) return false;
  if (!eventData.calendarId) return false;
  
  return true;
};

/**
 * Validates date values
 */
export const validateEventDates = (startTime: Date, endTime: Date): boolean => {
  if (!isValid(startTime) || !isValid(endTime)) return false;
  if (endTime <= startTime) return false;
  
  return true;
};

/**
 * Validates decrypted event data structure
 */
export const validateDecryptedEvent = (event: any): boolean => {
  if (!event || !event.id) return false;
  if (!event.encrypted_data) return false;
  if (!event.salt || !event.iv) return false;
  
  return true;
};
