import { 
  validateEventData, 
  validateEventDates, 
  validateDecryptedEvent 
} from '@/utils/calendar/eventValidation';

describe('eventValidation', () => {
  describe('validateEventData', () => {
    it('should return true for valid event data', () => {
      const validEvent = {
        title: 'Test Event',
        startTime: new Date(),
        endTime: new Date(),
        calendarId: 'cal-1'
      };
      expect(validateEventData(validEvent)).toBe(true);
    });

    it('should return false for missing title', () => {
      const invalidEvent = {
        title: '',
        startTime: new Date(),
        endTime: new Date(),
        calendarId: 'cal-1'
      };
      expect(validateEventData(invalidEvent)).toBe(false);
    });

    it('should return false for missing startTime', () => {
      const invalidEvent = {
        title: 'Test Event',
        endTime: new Date(),
        calendarId: 'cal-1'
      };
      expect(validateEventData(invalidEvent)).toBe(false);
    });

    it('should return false for missing calendarId', () => {
      const invalidEvent = {
        title: 'Test Event',
        startTime: new Date(),
        endTime: new Date()
      };
      expect(validateEventData(invalidEvent)).toBe(false);
    });

    it('should return false for null/undefined data', () => {
      expect(validateEventData(null)).toBe(false);
      expect(validateEventData(undefined)).toBe(false);
    });
  });

  describe('validateEventDates', () => {
    it('should return true for valid date range', () => {
      const startTime = new Date('2025-05-24T10:00:00Z');
      const endTime = new Date('2025-05-24T11:00:00Z');
      expect(validateEventDates(startTime, endTime)).toBe(true);
    });

    it('should return false when start time is after end time', () => {
      const startTime = new Date('2025-05-24T11:00:00Z');
      const endTime = new Date('2025-05-24T10:00:00Z');
      expect(validateEventDates(startTime, endTime)).toBe(false);
    });

    it('should return false when start time equals end time', () => {
      const time = new Date('2025-05-24T10:00:00Z');
      expect(validateEventDates(time, time)).toBe(false);
    });

    it('should return false for invalid dates', () => {
      const validDate = new Date('2025-05-24T10:00:00Z');
      const invalidDate = new Date('invalid');
      expect(validateEventDates(invalidDate, validDate)).toBe(false);
      expect(validateEventDates(validDate, invalidDate)).toBe(false);
    });
  });

  describe('validateDecryptedEvent', () => {
    it('should return true for valid decrypted event', () => {
      const validEvent = {
        id: 'event-1',
        encrypted_data: 'encrypted-string',
        salt: 'salt-string',
        iv: 'iv-string'
      };
      expect(validateDecryptedEvent(validEvent)).toBe(true);
    });

    it('should return false for missing id', () => {
      const invalidEvent = {
        encrypted_data: 'encrypted-string',
        salt: 'salt-string',
        iv: 'iv-string'
      };
      expect(validateDecryptedEvent(invalidEvent)).toBe(false);
    });

    it('should return false for missing encrypted_data', () => {
      const invalidEvent = {
        id: 'event-1',
        salt: 'salt-string',
        iv: 'iv-string'
      };
      expect(validateDecryptedEvent(invalidEvent)).toBe(false);
    });

    it('should return false for missing salt or iv', () => {
      const invalidEvent1 = {
        id: 'event-1',
        encrypted_data: 'encrypted-string',
        iv: 'iv-string'
      };
      const invalidEvent2 = {
        id: 'event-1',
        encrypted_data: 'encrypted-string',
        salt: 'salt-string'
      };
      expect(validateDecryptedEvent(invalidEvent1)).toBe(false);
      expect(validateDecryptedEvent(invalidEvent2)).toBe(false);
    });

    it('should return false for null/undefined event', () => {
      expect(validateDecryptedEvent(null)).toBe(false);
      expect(validateDecryptedEvent(undefined)).toBe(false);
    });
  });
});
