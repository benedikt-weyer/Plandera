import { CalendarEvent, Calendar, RecurrencePattern, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { isValid } from 'date-fns';
import { parseRRULEUntilDate } from './ics-parser';

/**
 * Parse an RFC 5545 RRULE string into a RecurrencePattern
 */
const parseRRULE = (rrule: string): RecurrencePattern | null => {
  const parts = rrule.split(';');
  const ruleData: Record<string, string> = {};
  
  // Parse RRULE parts into key-value pairs
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      ruleData[key] = value;
    }
  }
  
  // Convert FREQ to our RecurrenceFrequency enum
  let frequency: RecurrenceFrequency;
  switch (ruleData.FREQ) {
    case 'DAILY':
      frequency = RecurrenceFrequency.Daily;
      break;
    case 'WEEKLY':
      frequency = RecurrenceFrequency.Weekly;
      break;
    case 'MONTHLY':
      frequency = RecurrenceFrequency.Monthly;
      break;
    case 'YEARLY':
      frequency = RecurrenceFrequency.Yearly;
      break;
    default:
      return null;
  }
  
  const pattern: RecurrencePattern = {
    frequency,
    interval: ruleData.INTERVAL ? parseInt(ruleData.INTERVAL, 10) : 1,
    endDate: ruleData.UNTIL ? parseRRULEUntilDate(ruleData.UNTIL) || undefined : undefined,
    daysOfWeek: ruleData.BYDAY ? ruleData.BYDAY.split(',').map(day => {
      // Convert RRULE day names to day numbers (0=Sunday)
      const dayMap: Record<string, number> = {
        'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
      };
      return dayMap[day] ?? 0;
    }) : undefined
  };
  
  return pattern;
};
import { combineDateAndTime, createRecurrencePattern } from './recurrenceHelpers';

/**
 * Processes and validates event data before encryption
 */
export const processEventData = (values: any, calendars: Calendar[]) => {
  const startDateTime = combineDateAndTime(values.startDate, values.startTime || '00:00');
  const endDateTime = combineDateAndTime(values.endDate, values.endTime || '23:59');
  
  const recurrencePattern = createRecurrencePattern(
    values.recurrenceFrequency,
    values.recurrenceInterval,
    values.recurrenceEndDate,
    values.daysOfWeek
  );
  
  const calendar = calendars.find(cal => cal.id === values.calendarId);
  
  const eventData = {
    title: values.title.trim(),
    description: values.description?.trim() ?? '',
    location: values.location?.trim() ?? '',
    calendarId: values.calendarId,
    isAllDay: values.isAllDay ?? false,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
    recurrenceFrequency: values.recurrenceFrequency,
    recurrenceEndDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
    recurrenceInterval: values.recurrenceInterval,
    daysOfWeek: values.daysOfWeek
  };
  
  return {
    eventData,
    startDateTime,
    endDateTime,
    recurrencePattern,
    calendar
  };
};

/**
 * Processes decrypted event data into CalendarEvent format
 */
export const processDecryptedEvent = (
  rawEvent: any,
  decryptedData: any,
  calendars: Calendar[]
): CalendarEvent | null => {
  // Handle both camelCase and snake_case field names for backward compatibility
  const startTimeValue = decryptedData.startTime || decryptedData.start_time;
  const endTimeValue = decryptedData.endTime || decryptedData.end_time;
  
  const startTime = new Date(startTimeValue);
  const endTime = new Date(endTimeValue);
  
  if (!isValid(startTime) || !isValid(endTime)) {
    console.error('Invalid date found for event after decryption:', rawEvent.id, 
      { startTime: startTimeValue, endTime: endTimeValue, decryptedData });
    return null;
  }
  
  let recurrencePattern: RecurrencePattern | undefined;
  
  // Parse recurrence rule from JSON string or RRULE format
  const recurrenceRule = decryptedData.recurrence_rule || decryptedData.recurrenceRule;
  if (recurrenceRule) {
    try {
      // First try to parse as JSON (new format)
      const rule = typeof recurrenceRule === 'string' ? JSON.parse(recurrenceRule) : recurrenceRule;
      if (rule.frequency && rule.frequency !== RecurrenceFrequency.None) {
        recurrencePattern = {
          frequency: rule.frequency,
          interval: rule.interval ?? 1,
          endDate: rule.end_date ? new Date(rule.end_date) : undefined,
          daysOfWeek: rule.days_of_week
        };
      }
    } catch (jsonError) {
      // If JSON parsing fails, try to parse as RRULE format
      try {
        if (typeof recurrenceRule === 'string' && recurrenceRule.startsWith('FREQ=')) {
          const rrulePattern = parseRRULE(recurrenceRule);
          if (rrulePattern) {
            recurrencePattern = rrulePattern;
          }
        }
      } catch (rruleError) {
        console.error('Failed to parse recurrence rule as both JSON and RRULE:', recurrenceRule, { jsonError, rruleError });
      }
    }
  }
  
  // Fallback to old format for backward compatibility
  if (!recurrencePattern && decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
    recurrencePattern = {
      frequency: decryptedData.recurrenceFrequency,
      interval: decryptedData.recurrenceInterval ?? 1,
      endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
      daysOfWeek: decryptedData.daysOfWeek
    };
  }
  
  // Handle both camelCase and snake_case for calendar ID
  const calendarId = decryptedData.calendarId || decryptedData.calendar_id;
  const calendar = calendars.find(cal => cal.id === calendarId);
  
  return {
    id: rawEvent.id,
    title: decryptedData.title,
    description: decryptedData.description,
    location: decryptedData.location,
    calendar_id: calendarId,
    start_time: startTimeValue,
    end_time: endTimeValue,
    all_day: decryptedData.isAllDay ?? decryptedData.all_day ?? false,
    recurrence_rule: decryptedData.recurrence_rule,
    recurrence_exception: decryptedData.recurrence_exception,
    created_at: rawEvent.created_at,
    updated_at: rawEvent.updated_at,
    user_id: rawEvent.user_id
  };
};

/**
 * Sorts events by start time
 */
export const sortEventsByStartTime = (events: CalendarEvent[]): CalendarEvent[] => {
  return events
    .filter(event => isValid(new Date(event.start_time)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
};

/**
 * Extract recurrence pattern from a CalendarEvent
 */
export const getRecurrencePattern = (event: CalendarEvent): RecurrencePattern | undefined => {
  if (!event.recurrence_rule) {
    return undefined;
  }

  try {
    // First try to parse as JSON
    const rule = typeof event.recurrence_rule === 'string' ? JSON.parse(event.recurrence_rule) : event.recurrence_rule;
    if (rule.frequency && rule.frequency !== RecurrenceFrequency.None) {
      return {
        frequency: rule.frequency,
        interval: rule.interval ?? 1,
        endDate: rule.end_date ? new Date(rule.end_date) : undefined,
        daysOfWeek: rule.days_of_week
      };
    }
  } catch (jsonError) {
    // If JSON parsing fails, try to parse as RRULE format
    try {
      if (typeof event.recurrence_rule === 'string' && event.recurrence_rule.startsWith('FREQ=')) {
        const rrulePattern = parseRRULE(event.recurrence_rule);
        if (rrulePattern) {
          return rrulePattern;
        }
      }
    } catch (rruleError) {
      console.error('Failed to parse recurrence rule as both JSON and RRULE:', event.recurrence_rule, { jsonError, rruleError });
    }
  }
  
  return undefined;
};

/**
 * Check if an event has recurrence
 */
export const hasRecurrence = (event: CalendarEvent): boolean => {
  const pattern = getRecurrencePattern(event);
  return pattern !== undefined && pattern.frequency !== RecurrenceFrequency.None;
};
