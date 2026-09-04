import { 
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  endOfDay
} from 'date-fns';
import { RecurrenceFrequency, RecurrencePattern } from '@/utils/calendar/calendar-types';

/**
 * Helper function to combine date and time
 */
export const combineDateAndTime = (date: Date | string, time: string): Date => {
  const result = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Creates a recurrence pattern from form values
 */
export const createRecurrencePattern = (
  recurrenceFrequency?: RecurrenceFrequency,
  recurrenceInterval?: number,
  recurrenceEndDate?: string,
  daysOfWeek?: number[]
): RecurrencePattern | undefined => {
  if (!recurrenceFrequency || recurrenceFrequency === RecurrenceFrequency.None) {
    return undefined;
  }

  return {
    frequency: recurrenceFrequency,
    interval: recurrenceInterval ?? 1,
    endDate: recurrenceEndDate ? endOfDay(new Date(recurrenceEndDate)) : undefined,
    daysOfWeek
  };
};

/**
 * Calculates the next occurrence date based on frequency and interval
 */
export const calculateNextOccurrence = (
  startDate: Date,
  frequency: RecurrenceFrequency,
  interval: number = 1
): Date => {
  switch (frequency) {
    case RecurrenceFrequency.Daily:
      return addDays(startDate, interval);
    case RecurrenceFrequency.Weekly:
      return addWeeks(startDate, interval);
    case RecurrenceFrequency.BiWeekly:
      return addWeeks(startDate, 2 * interval);
    case RecurrenceFrequency.Monthly:
      return addMonths(startDate, interval);
    case RecurrenceFrequency.Yearly:
      return addYears(startDate, interval);
    default:
      throw new Error(`Unknown recurrence frequency: ${frequency}`);
  }
};

/**
 * Calculates the previous occurrence date for ending recurrence patterns
 */
export const calculatePreviousOccurrence = (
  startDate: Date,
  frequency: RecurrenceFrequency,
  interval: number = 1
): Date => {
  switch (frequency) {
    case RecurrenceFrequency.Daily:
      return subDays(startDate, interval);
    case RecurrenceFrequency.Weekly:
      return addWeeks(startDate, -interval);
    case RecurrenceFrequency.BiWeekly:
      return addWeeks(startDate, -2 * interval);
    case RecurrenceFrequency.Monthly:
      return addMonths(startDate, -interval);
    case RecurrenceFrequency.Yearly:
      return addYears(startDate, -interval);
    default:
      throw new Error(`Unknown recurrence frequency: ${frequency}`);
  }
};
