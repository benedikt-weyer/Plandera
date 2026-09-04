'use client';

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarService } from '@/services/calendar/calendar-service';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { generateRecurrenceInstancesInRange } from '@/utils/calendar/calendar';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { SchedulerCalendarService } from './scheduler-calendar-service';
import { SchedulerEventService } from './scheduler-event-service';
import { SchedulerICSService } from './scheduler-ics-service';

/**
 * Scheduler Page Service - Main orchestration service for the scheduler page
 * Combines calendar, event, and ICS services with scheduling-specific logic
 */
export class SchedulerPageService {
  private calendarService: CalendarService;
  
  // Sub-services for specific functionality
  public calendarOps: SchedulerCalendarService;
  public eventOps: SchedulerEventService;
  public icsOps: SchedulerICSService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarService = new CalendarService(backend);
    this.calendarOps = new SchedulerCalendarService(backend);
    this.eventOps = new SchedulerEventService(backend);
    this.icsOps = new SchedulerICSService(backend);
  }

  /**
   * Load all calendars and events for the scheduler
   */
  async loadSchedulerData(): Promise<{ calendars: Calendar[]; events: CalendarEvent[] }> {
    try {
      // Load calendars first
      const calendars = await this.calendarService.getCalendars();
      
      // Then load events with calendar context
      const events = await this.eventOps.calendarEventsService.getCalendarEvents(calendars);
      
      return { calendars, events };
    } catch (error) {
      console.error('Failed to load scheduler data:', error);
      throw new Error('Failed to load scheduler data');
    }
  }

  /**
   * Find available time slots on a given date
   */
  async getAvailableTimeSlots(
    date: Date,
    duration: number,
    calendars: Calendar[]
  ): Promise<{ start: Date; end: Date }[]> {
    // Get all events for the specified date
    const events = await this.eventOps.calendarEventsService.getCalendarEvents(calendars);
    
    // Filter events for the target date
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    // Expand recurring events to include their instances for this day
    const expandedEvents: CalendarEvent[] = [];
    
    for (const event of events) {
      // Check if this is a recurring event
      const recurrencePattern = getRecurrencePattern(event);
      
      if (recurrencePattern && recurrencePattern.frequency !== 'none') {
        // Generate recurring instances for this specific day
        const instances = generateRecurrenceInstancesInRange(
          event,
          dateStart,
          dateEnd,
          recurrencePattern
        );
        
        // Add the original event if it falls on this day
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (eventStart < dateEnd && eventEnd > dateStart) {
          expandedEvents.push(event);
        }
        
        // Add all generated instances
        expandedEvents.push(...instances);
      } else {
        // Non-recurring event, just add if it's on this day
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (eventStart < dateEnd && eventEnd > dateStart) {
          expandedEvents.push(event);
        }
      }
    }

    // Sort events by start time, excluding all-day events
    const sortedEvents = expandedEvents
      .filter(event => !event.all_day)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const availableSlots: { start: Date; end: Date }[] = [];

    // Determine the earliest possible start time for the day
    // Use the current time if it's today, otherwise start of day
    const now = new Date();
    const isToday = dateStart.toDateString() === now.toDateString();
    const earliestStart = isToday && now > dateStart ? now : dateStart;
    
    // Snap to next 15-minute interval
    const snappedEarliestStart = this.snapToNext15Minutes(earliestStart);

    // If no events exist, the entire day is available (from earliest start time)
    if (sortedEvents.length === 0) {
      availableSlots.push({
        start: new Date(snappedEarliestStart),
        end: new Date(snappedEarliestStart.getTime() + duration * 60 * 1000)
      });
      return availableSlots;
    }

    // Check for gap at the beginning of the day (before first event)
    const firstEventStart = new Date(sortedEvents[0].start_time);
    if (firstEventStart > snappedEarliestStart) {
      const gapDuration = firstEventStart.getTime() - snappedEarliestStart.getTime();
      if (gapDuration >= duration * 60 * 1000) {
        availableSlots.push({
          start: new Date(snappedEarliestStart),
          end: new Date(snappedEarliestStart.getTime() + duration * 60 * 1000)
        });
      }
    }

    // Check for gaps between events
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEventEnd = new Date(sortedEvents[i].end_time);
      const nextEventStart = new Date(sortedEvents[i + 1].start_time);

      if (currentEventEnd < nextEventStart) {
        // Snap the gap start time to next 15-minute interval
        const snappedGapStart = this.snapToNext15Minutes(currentEventEnd);
        const gapDuration = nextEventStart.getTime() - snappedGapStart.getTime();
        if (gapDuration >= duration * 60 * 1000) {
          availableSlots.push({
            start: new Date(snappedGapStart),
            end: new Date(snappedGapStart.getTime() + duration * 60 * 1000)
          });
        }
      }
    }

    // Check for gap at the end of the day (after last event)
    const lastEventEnd = new Date(sortedEvents[sortedEvents.length - 1].end_time);
    if (lastEventEnd < dateEnd) {
      // Snap the gap start time to next 15-minute interval
      const snappedGapStart = this.snapToNext15Minutes(lastEventEnd);
      const gapDuration = dateEnd.getTime() - snappedGapStart.getTime();
      if (gapDuration >= duration * 60 * 1000) {
        availableSlots.push({
          start: new Date(snappedGapStart),
          end: new Date(snappedGapStart.getTime() + duration * 60 * 1000)
        });
      }
    }

    return availableSlots;
  }

  /**
   * Find the next free slot starting from now
   */
  async findNextFreeSlot(
    duration: number,
    calendars: Calendar[],
    startFromDate?: Date
  ): Promise<{ start: Date; end: Date } | null> {
    const startDate = startFromDate || new Date();
    const maxDaysToSearch = 7;

    for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);

      const slots = await this.getAvailableTimeSlots(checkDate, duration, calendars);
      
      // Filter out slots that are in the past (for today)
      const now = new Date();
      const futureSlots = slots.filter(slot => slot.start >= now);
      
      if (futureSlots.length > 0) {
        return futureSlots[0];
      }
    }

    return null;
  }

  /**
   * Snap a date to the next 15-minute interval
   */
  private snapToNext15Minutes(date: Date): Date {
    const snapped = new Date(date);
    const minutes = snapped.getMinutes();
    const remainder = minutes % 15;
    
    if (remainder !== 0) {
      // Round up to next 15-minute mark
      snapped.setMinutes(minutes + (15 - remainder));
      snapped.setSeconds(0);
      snapped.setMilliseconds(0);
    }
    
    return snapped;
  }

  // Delegation methods for convenience (delegates to sub-services)

  // Calendar operations
  async toggleCalendarVisibility(calendarId: string, isVisible: boolean): Promise<Calendar> {
    return this.calendarOps.toggleCalendarVisibility(calendarId, isVisible);
  }

  async createCalendar(name: string, color: string) {
    return this.calendarOps.createCalendar(name, color);
  }

  async createICSCalendar(name: string, color: string, icsUrl: string) {
    return this.calendarOps.createICSCalendar(name, color, icsUrl);
  }

  async editCalendar(id: string, name: string, color: string): Promise<Calendar> {
    return this.calendarOps.editCalendar(id, name, color);
  }

  async deleteCalendarWithEvents(calendarId: string, calendars: Calendar[]) {
    return this.calendarOps.deleteCalendarWithEvents(calendarId, calendars);
  }

  async setDefaultCalendar(calendarId: string): Promise<Calendar> {
    return this.calendarOps.setDefaultCalendar(calendarId);
  }

  isReadOnlyCalendar(calendarId: string, calendars: Calendar[]): boolean {
    return this.calendarOps.isReadOnlyCalendar(calendarId, calendars);
  }

  isICSEvent(event: { calendar_id: string }, calendars: Calendar[]): boolean {
    return this.calendarOps.isICSEvent(event, calendars);
  }

  // Event operations
  async submitEvent(values: any) {
    return this.eventOps.submitEvent(values);
  }

  async deleteEvent(eventId: string): Promise<void> {
    return this.eventOps.deleteEvent(eventId);
  }

  async deleteThisOccurrence(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]) {
    return this.eventOps.deleteThisOccurrence(eventToDelete, allEvents);
  }

  async deleteThisAndFuture(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]) {
    return this.eventOps.deleteThisAndFuture(eventToDelete, allEvents);
  }

  async modifyThisOccurrence(eventToModify: CalendarEvent, modifications: Partial<CalendarEvent>, allEvents: CalendarEvent[]) {
    return this.eventOps.modifyThisOccurrence(eventToModify, modifications, allEvents);
  }

  async modifyThisAndFuture(eventToModify: CalendarEvent, modifications: Partial<CalendarEvent>, allEvents: CalendarEvent[]) {
    return this.eventOps.modifyThisAndFuture(eventToModify, modifications, allEvents);
  }

  async modifyAllInSeries(eventToModify: CalendarEvent, modifications: Partial<CalendarEvent>, allEvents: CalendarEvent[]) {
    return this.eventOps.modifyAllInSeries(eventToModify, modifications, allEvents);
  }

  async cloneEvent(event: CalendarEvent): Promise<CalendarEvent> {
    return this.eventOps.cloneEvent(event);
  }

  async updateEvent(eventId: string, updates: any) {
    return this.eventOps.updateEvent(eventId, updates);
  }

  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    return this.eventOps.moveEventToCalendar(eventId, targetCalendarId);
  }

  async createEventFromTask(task: any, calendarId: string, startTime: Date): Promise<CalendarEvent> {
    return this.eventOps.createEventFromTask(task, calendarId, startTime);
  }

  // ICS operations
  async fetchICSEventsForCalendar(calendar: Calendar): Promise<CalendarEvent[]> {
    return this.icsOps.fetchICSEventsForCalendar(calendar);
  }

  async fetchAllICSEvents(calendars: Calendar[]): Promise<CalendarEvent[]> {
    return this.icsOps.fetchAllICSEvents(calendars);
  }

  async refreshICSEventsForCalendar(calendarId: string, calendars: Calendar[]) {
    return this.icsOps.refreshICSEventsForCalendar(calendarId, calendars);
  }
}
