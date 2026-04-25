import { CalendarEvent } from "@/utils/calendar/calendar-types";
import {
  filterEventsForDay,
  filterEventsForMonth,
  filterEventsForWeek,
} from "@/utils/calendar/calendar";

// Helper function to combine date and time
export const combineDateAndTime = (date: Date, time: string): Date => {
  const result = new Date(date);
  const [hours, minutes] = time.split(":").map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

// Calculate days of the week for a given date
export const getDaysOfWeek = (date: Date, weekStartsOn: 0 | 1 = 1): Date[] => {
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;

  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);

  const days = [weekStart];

  for (let i = 1; i < 7; i++) {
    const nextDay = new Date(weekStart);
    nextDay.setDate(weekStart.getDate() + i);
    days.push(nextDay);
  }

  return days;
};

export const getEventsInDay = (
  events: CalendarEvent[],
  currentDate: Date,
): CalendarEvent[] => {
  return filterEventsForDay(events, currentDate);
};

// Get events for the current week
export const getEventsInWeek = (
  events: CalendarEvent[],
  weekStart: Date,
  weekStartsOn: 0 | 1 = 1,
): CalendarEvent[] => {
  // Use the filterEventsForWeek function which properly handles recurring events
  return filterEventsForWeek(events, weekStart, weekStartsOn);
};

export const getEventsInMonth = (
  events: CalendarEvent[],
  currentDate: Date,
  weekStartsOn: 0 | 1 = 1,
): CalendarEvent[] => {
  return filterEventsForMonth(events, currentDate, weekStartsOn);
};

// Format time for display (12:30 PM)
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Format date for display (Monday, Jan 1)
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

// Check if two dates are on the same day
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};
