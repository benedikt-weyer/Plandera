'use client';

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { fetchAndParseICSCalendar } from '@/utils/calendar/ics-parser';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';

/**
 * Scheduler ICS Service - handles ICS calendar operations for the scheduler
 */
export class SchedulerICSService {
  private calendarService: CalendarService;
  private calendarEventsService: CalendarEventsService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarService = new CalendarService(backend);
    this.calendarEventsService = new CalendarEventsService(backend);
  }

  /**
   * Fetch ICS events for a specific calendar
   */
  async fetchICSEventsForCalendar(calendar: Calendar): Promise<CalendarEvent[]> {
    if (calendar.type !== 'ics' || !calendar.ics_url) {
      return [];
    }

    try {
      const events = await fetchAndParseICSCalendar(calendar.ics_url, calendar.id);
      // Transform and add calendar_id to each event
      return events.map(event => ({
        ...event,
        calendar_id: calendar.id,
        user_id: calendar.user_id
      }));
    } catch (error) {
      console.error(`Failed to fetch ICS events for calendar ${calendar.name || calendar.id}:`, error);
      
      // Check if it's a CORS error and provide helpful message
      if (error instanceof Error && error.message.includes('CORS_ERROR')) {
        console.warn(`CORS Error for calendar "${calendar.name || calendar.id}": The calendar does not allow cross-origin requests. Please contact your calendar provider to enable CORS.`);
      }
      
      // Return empty array instead of throwing to prevent breaking the entire scheduler
      return [];
    }
  }

  /**
   * Fetch all ICS events from all ICS calendars
   */
  async fetchAllICSEvents(calendars: Calendar[]): Promise<CalendarEvent[]> {
    const icsCalendars = calendars.filter(cal => cal.type === 'ics' && cal.ics_url);
    
    if (icsCalendars.length === 0) {
      return [];
    }

    try {
      const allICSEvents = await Promise.all(
        icsCalendars.map(calendar => this.fetchICSEventsForCalendar(calendar))
      );
      
      return allICSEvents.flat();
    } catch (error) {
      console.error('Failed to fetch ICS events:', error);
      throw new Error('Failed to load ICS calendar events');
    }
  }

  /**
   * Refresh ICS events for a specific calendar
   */
  async refreshICSEventsForCalendar(
    calendarId: string, 
    calendars: Calendar[]
  ): Promise<{ events: CalendarEvent[]; calendar: Calendar }> {
    try {
      const calendar = calendars.find(cal => cal.id === calendarId);
      
      if (!calendar) {
        throw new Error('Calendar not found');
      }

      if (calendar.type !== 'ics') {
        throw new Error('Not an ICS calendar');
      }

      // Fetch fresh ICS events
      const events = await this.fetchICSEventsForCalendar(calendar);
      
      // Update the last_sync timestamp
      const updatedCalendar = await this.calendarService.updateCalendar(calendarId, {
        lastSync: new Date().toISOString()
      });

      return { events, calendar: updatedCalendar };
    } catch (error) {
      console.error(`Failed to refresh ICS calendar ${calendarId}:`, error);
      throw new Error('Failed to refresh ICS calendar');
    }
  }

  /**
   * Refresh ICS calendar
   */
  async refreshICSCalendar(calendarId: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      const calendar = calendars.find(cal => cal.id === calendarId);
      
      if (!calendar) {
        throw new Error('Calendar not found');
      }

      if (calendar.type !== 'ics') {
        throw new Error('Not an ICS calendar');
      }

      // Update the last_sync timestamp
      const updatedCalendar = await this.calendarService.updateCalendar(calendarId, {
        lastSync: new Date().toISOString()
      });

      return { calendar: updatedCalendar, shouldRefreshEvents: true };
    } catch (error) {
      console.error(`Failed to refresh ICS calendar ${calendarId}:`, error);
      throw new Error('Failed to refresh ICS calendar');
    }
  }

  /**
   * Get all events including ICS events
   */
  async getAllEventsWithICS(): Promise<{
    regularEvents: CalendarEvent[];
    icsEvents: CalendarEvent[];
    allEvents: CalendarEvent[];
  }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      
      // Get regular events
      const regularEvents = await this.calendarEventsService.getCalendarEvents(calendars);
      
      // Get ICS events
      const icsEvents = await this.fetchAllICSEvents(calendars);
      
      return {
        regularEvents,
        icsEvents,
        allEvents: [...regularEvents, ...icsEvents]
      };
    } catch (error) {
      console.error('Failed to get all events with ICS:', error);
      throw new Error('Failed to load events');
    }
  }

  /**
   * Get events in range including ICS events
   */
  async getEventsInRangeWithICS(
    startDate: Date,
    endDate: Date,
    calendars?: Calendar[]
  ): Promise<{
    regularEvents: CalendarEvent[];
    icsEvents: CalendarEvent[];
    allEvents: CalendarEvent[];
  }> {
    try {
      const cals = calendars || await this.calendarService.getCalendars();
      
      // Get regular events
      const allRegularEvents = await this.calendarEventsService.getCalendarEvents(cals);
      const regularEventsInRange = allRegularEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return eventStart < endDate && eventEnd > startDate;
      });
      
      // Get ICS events
      const allICSEvents = await this.fetchAllICSEvents(cals);
      const icsEventsInRange = allICSEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return eventStart < endDate && eventEnd > startDate;
      });
      
      return {
        regularEvents: regularEventsInRange,
        icsEvents: icsEventsInRange,
        allEvents: [...regularEventsInRange, ...icsEventsInRange]
      };
    } catch (error) {
      console.error('Failed to get events in range with ICS:', error);
      throw new Error('Failed to get events in range');
    }
  }

  /**
   * Search events including ICS events
   */
  async searchEventsWithICS(query: string, calendars?: Calendar[]): Promise<CalendarEvent[]> {
    try {
      if (!query.trim()) {
        return [];
      }

      const cals = calendars || await this.calendarService.getCalendars();
      const searchLower = query.toLowerCase();
      
      // Search regular events
      const regularEvents = await this.calendarEventsService.getCalendarEvents(cals);
      const matchingRegular = regularEvents.filter(event => {
        return (
          event.title.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.location?.toLowerCase().includes(searchLower)
        );
      });
      
      // Search ICS events
      const icsEvents = await this.fetchAllICSEvents(cals);
      const matchingICS = icsEvents.filter(event => {
        return (
          event.title.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.location?.toLowerCase().includes(searchLower)
        );
      });
      
      return [...matchingRegular, ...matchingICS];
    } catch (error) {
      console.error('Failed to search events with ICS:', error);
      throw new Error('Failed to search events');
    }
  }
}

