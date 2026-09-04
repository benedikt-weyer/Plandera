'use client';

import { Calendar } from '@/utils/calendar/calendar-types';
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';

/**
 * Scheduler Calendar Service - handles calendar-specific operations for the scheduler
 */
export class SchedulerCalendarService {
  private calendarService: CalendarService;
  private calendarEventsService: CalendarEventsService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarService = new CalendarService(backend);
    this.calendarEventsService = new CalendarEventsService(backend);
  }

  /**
   * Toggle calendar visibility
   */
  async toggleCalendarVisibility(calendarId: string, isVisible: boolean): Promise<Calendar> {
    try {
      return await this.calendarService.toggleCalendarVisibility(calendarId, isVisible);
    } catch (error) {
      console.error(`Failed to toggle calendar visibility for ${calendarId}:`, error);
      throw new Error('Failed to toggle calendar visibility');
    }
  }

  /**
   * Create a new calendar and ensure default calendar exists
   */
  async createCalendar(name: string, color: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendar = await this.calendarService.createCalendar(name, color);
      
      // Check if this is the first calendar (should be set as default)
      const allCalendars = await this.calendarService.getCalendars();
      if (allCalendars.length === 1) {
        const updatedCalendar = await this.calendarService.setDefaultCalendar(calendar.id);
        return { calendar: updatedCalendar, shouldRefreshEvents: false };
      }
      
      return { calendar, shouldRefreshEvents: false };
    } catch (error) {
      console.error('Failed to create calendar:', error);
      throw new Error('Failed to create calendar');
    }
  }

  /**
   * Create an ICS calendar
   */
  async createICSCalendar(name: string, color: string, icsUrl: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendar = await this.calendarService.createICSCalendar(name, color, icsUrl);
      return { calendar, shouldRefreshEvents: true }; // ICS calendars may have events to load
    } catch (error) {
      console.error('Failed to create ICS calendar:', error);
      throw new Error('Failed to create ICS calendar');
    }
  }

  /**
   * Edit calendar details
   */
  async editCalendar(id: string, name: string, color: string): Promise<Calendar> {
    try {
      return await this.calendarService.updateCalendar(id, { name, color });
    } catch (error) {
      console.error(`Failed to edit calendar ${id}:`, error);
      throw new Error('Failed to edit calendar');
    }
  }

  /**
   * Set a calendar as default
   */
  async setDefaultCalendar(calendarId: string): Promise<Calendar> {
    try {
      return await this.calendarService.setDefaultCalendar(calendarId);
    } catch (error) {
      console.error(`Failed to set default calendar ${calendarId}:`, error);
      throw new Error('Failed to set default calendar');
    }
  }

  /**
   * Delete a calendar and all its events
   */
  async deleteCalendarWithEvents(
    calendarId: string, 
    calendars: Calendar[]
  ): Promise<{ 
    deletedCalendarId: string; 
    deletedEventIds: string[];
    newDefaultCalendar?: Calendar;
  }> {
    try {
      // Check if this is the default calendar
      const calendar = calendars.find(cal => cal.id === calendarId);
      const wasDefault = calendar?.is_default || false;
      
      // Get all events for this calendar
      const allEvents = await this.calendarEventsService.getCalendarEvents(calendars);
      const eventsToDelete = allEvents.filter(event => event.calendar_id === calendarId);
      
      // Delete all events first
      await Promise.all(
        eventsToDelete.map(event => this.calendarEventsService.deleteCalendarEvent(event.id))
      );
      
      // Delete the calendar
      await this.calendarService.deleteCalendar(calendarId);
      
      // If this was the default calendar and there are other calendars, set a new default
      let newDefaultCalendar: Calendar | undefined;
      if (wasDefault) {
        const remainingCalendars = calendars.filter(cal => cal.id !== calendarId && cal.type !== 'ics');
        if (remainingCalendars.length > 0) {
          newDefaultCalendar = await this.calendarService.setDefaultCalendar(remainingCalendars[0].id);
        }
      }
      
      return { 
        deletedCalendarId: calendarId, 
        deletedEventIds: eventsToDelete.map(e => e.id),
        newDefaultCalendar 
      };
    } catch (error) {
      console.error(`Failed to delete calendar ${calendarId}:`, error);
      throw new Error('Failed to delete calendar');
    }
  }

  /**
   * Ensure a default calendar exists
   */
  async ensureDefaultCalendar(): Promise<Calendar> {
    try {
      const calendars = await this.calendarService.getCalendars();
      
      // Filter out ICS calendars
      const regularCalendars = calendars.filter(cal => cal.type !== 'ics');
      
      // Check if there's already a default calendar
      const defaultCalendar = regularCalendars.find(cal => cal.is_default);
      if (defaultCalendar) {
        return defaultCalendar;
      }
      
      // If no default and there are regular calendars, set the first one as default
      if (regularCalendars.length > 0) {
        return await this.calendarService.setDefaultCalendar(regularCalendars[0].id);
      }
      
      // If no calendars exist, create a default one
      const newCalendar = await this.calendarService.createCalendar('My Calendar', '#3b82f6');
      return await this.calendarService.setDefaultCalendar(newCalendar.id);
    } catch (error) {
      console.error('Failed to ensure default calendar:', error);
      throw new Error('Failed to ensure default calendar');
    }
  }

  /**
   * Get visible calendars only
   */
  async getVisibleCalendars(): Promise<Calendar[]> {
    try {
      const calendars = await this.calendarService.getCalendars();
      return calendars.filter(cal => cal.is_visible);
    } catch (error) {
      console.error('Failed to get visible calendars:', error);
      throw new Error('Failed to get visible calendars');
    }
  }

  /**
   * Validate calendar operation
   */
  async validateCalendarOperation(operation: 'delete' | 'move', calendarId: string): Promise<{ 
    isValid: boolean; 
    message?: string;
    calendar?: Calendar;
  }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      const calendar = calendars.find(cal => cal.id === calendarId);
      
      if (!calendar) {
        return {
          isValid: false,
          message: 'Calendar not found'
        };
      }

      if (operation === 'delete') {
        // Check if it's an ICS calendar
        if (calendar.type === 'ics') {
          return {
            isValid: true,
            message: 'ICS calendar can be deleted',
            calendar
          };
        }

        // Check if it's the last regular calendar
        const regularCalendars = calendars.filter(cal => cal.type !== 'ics');
        if (regularCalendars.length === 1 && calendar.type === 'regular') {
          return {
            isValid: false,
            message: 'Cannot delete the last regular calendar'
          };
        }
      }

      if (operation === 'move') {
        // Check if calendar is read-only (e.g., ICS calendar)
        if (calendar.type === 'ics') {
          return {
            isValid: false,
            message: 'Cannot move events to a read-only calendar'
          };
        }
      }

      return {
        isValid: true,
        calendar
      };
    } catch (error) {
      console.error('Failed to validate calendar operation:', error);
      return {
        isValid: false,
        message: 'Failed to validate operation'
      };
    }
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(): Promise<{
    totalCalendars: number;
    regularCalendars: number;
    icsCalendars: number;
    visibleCalendars: number;
    defaultCalendar?: Calendar;
  }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      
      return {
        totalCalendars: calendars.length,
        regularCalendars: calendars.filter(cal => cal.type !== 'ics').length,
        icsCalendars: calendars.filter(cal => cal.type === 'ics').length,
        visibleCalendars: calendars.filter(cal => cal.is_visible).length,
        defaultCalendar: calendars.find(cal => cal.is_default)
      };
    } catch (error) {
      console.error('Failed to get calendar stats:', error);
      throw new Error('Failed to get calendar stats');
    }
  }

  /**
   * Check if calendar is read-only (e.g., ICS calendar)
   */
  isReadOnlyCalendar(calendarId: string, calendars: Calendar[]): boolean {
    const calendar = calendars.find(cal => cal.id === calendarId);
    return calendar?.type === 'ics';
  }

  /**
   * Check if event belongs to an ICS calendar
   */
  isICSEvent(event: { calendar_id: string }, calendars: Calendar[]): boolean {
    const calendar = calendars.find(cal => cal.id === event.calendar_id);
    return calendar?.type === 'ics';
  }
}

