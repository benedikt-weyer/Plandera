import {
  CalendarDecrypted,
  CalendarEncrypted,
  CalendarEventDecrypted,
  CalendarEventEncrypted,
} from "@/utils/api/types";

// Define recurring event frequency options
export enum RecurrenceFrequency {
  None = "none",
  Daily = "daily",
  Weekly = "weekly",
  BiWeekly = "biweekly", // Every two weeks
  Monthly = "monthly",
  Yearly = "yearly",
}

// Define calendar types
export enum CalendarType {
  Regular = "regular",
  ICS = "ics",
}

export type CalendarView = "day" | "week" | "month";

export type Calendar = CalendarDecrypted;

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  endDate?: Date; // Optional end date for the recurrence
  interval?: number; // How many units between occurrences (default: 1)
  daysOfWeek?: number[]; // For weekly/monthly recurrence (0 = Sunday, 6 = Saturday)
}

export type CalendarEvent = CalendarEventDecrypted;

export interface EventFormValues {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay?: boolean; // New property for all-day events
  calendarId: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  daysOfWeek?: number[];
  isGroupEvent?: boolean;
  parentGroupEventId?: string;
  taskId?: string; // Link to a can-do list task
}
