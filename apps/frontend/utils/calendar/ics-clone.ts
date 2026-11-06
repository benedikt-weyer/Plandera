/**
 * Helpers for cloning events from read-only ICS calendars into regular calendars.
 */

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';

/** Calendars an event can be created in (everything but read-only ICS calendars). */
export function getWritableCalendars(calendars: Calendar[]): Calendar[] {
  return calendars.filter(calendar => calendar.type !== 'ics');
}

/** The calendar to preselect for a clone: the preferred one if it is writable, else the first writable one. */
export function pickWritableCalendarId(calendars: Calendar[], preferredCalendarId?: string): string | undefined {
  const writable = getWritableCalendars(calendars);
  return writable.find(calendar => calendar.id === preferredCalendarId)?.id ?? writable[0]?.id;
}

/**
 * An unsaved copy of an event, ready to be shown in the new-event form
 * (the "new" id makes the form create an event instead of updating one).
 * The user chooses the final calendar in the form.
 */
export function createEventCloneDraft(event: CalendarEvent, calendarId: string, now: Date = new Date()): CalendarEvent {
  const timestamp = now.toISOString();
  return {
    ...event,
    id: 'new',
    calendar_id: calendarId,
    user_id: '',
    created_at: timestamp,
    updated_at: timestamp,
  };
}
