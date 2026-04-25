'use client';

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { EventFormValues } from '@/components/calendar/calendar-event-dialog';

/**
 * Scheduler Event Service - handles event operations for the scheduler
 */
export class SchedulerEventService {
  public calendarEventsService: CalendarEventsService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarEventsService = new CalendarEventsService(backend);
  }

  /**
   * Submit an event (create or update)
   */
  async submitEvent(values: EventFormValues): Promise<{ event: CalendarEvent; isUpdate: boolean }> {
    const isUpdate = !!values.id && values.id !== 'new';
    
    // Convert form values to proper Date objects
    const startDateTime = values.isAllDay 
      ? new Date(`${values.startDate}T00:00:00`)
      : new Date(`${values.startDate}T${values.startTime}`);
    
    const endDateTime = values.isAllDay 
      ? new Date(`${values.endDate}T23:59:59`)
      : new Date(`${values.endDate}T${values.endTime}`);
    
    // Build recurrence rule if recurrence is specified
    let recurrenceRule: string | undefined = undefined;
    if (values.recurrenceFrequency && values.recurrenceFrequency !== 'none') {
      recurrenceRule = JSON.stringify({
        frequency: values.recurrenceFrequency,
        end_date: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
        interval: values.recurrenceInterval ?? 1,
        days_of_week: values.daysOfWeek
      });
    }
    
    if (isUpdate) {
      const updatedEvent = await this.calendarEventsService.updateCalendarEvent(values.id!, {
        title: values.title,
        description: values.description,
        location: values.location,
        calendarId: values.calendarId,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: values.isAllDay,
        recurrenceRule: recurrenceRule,
        isGroupEvent: values.isGroupEvent,
        isTaskReservationSpace: values.isTaskReservationSpace,
        parentGroupEventId: values.parentGroupEventId,
        taskId: values.taskId
      });
      return { event: updatedEvent, isUpdate: true };
    } else {
      const newEvent = await this.calendarEventsService.createCalendarEvent({
        title: values.title,
        description: values.description,
        location: values.location,
        calendarId: values.calendarId,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: values.isAllDay,
        recurrenceRule: recurrenceRule,
        isGroupEvent: values.isGroupEvent,
        isTaskReservationSpace: values.isTaskReservationSpace,
        parentGroupEventId: values.parentGroupEventId,
        taskId: values.taskId
      });
      return { event: newEvent, isUpdate: false };
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    return await this.calendarEventsService.deleteCalendarEvent(eventId);
  }

  /**
   * Delete this occurrence of a recurring event
   */
  async deleteThisOccurrence(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    return await this.calendarEventsService.deleteThisOccurrence(eventToDelete, allEvents);
  }

  /**
   * Delete this and all future occurrences of a recurring event
   */
  async deleteThisAndFuture(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    return await this.calendarEventsService.deleteThisAndFuture(eventToDelete, allEvents);
  }

  /**
   * Modify this occurrence of a recurring event
   */
  async modifyThisOccurrence(
    eventToModify: CalendarEvent,
    modifications: Partial<CalendarEvent>,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    return await this.calendarEventsService.modifyThisOccurrence(eventToModify, modifications, allEvents);
  }

  /**
   * Modify this and all future occurrences of a recurring event
   */
  async modifyThisAndFuture(
    eventToModify: CalendarEvent,
    modifications: Partial<CalendarEvent>,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    return await this.calendarEventsService.modifyThisAndFuture(eventToModify, modifications, allEvents);
  }

  /**
   * Modify all occurrences in the series
   */
  async modifyAllInSeries(
    eventToModify: CalendarEvent,
    modifications: Partial<CalendarEvent>,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    return await this.calendarEventsService.modifyAllInSeries(eventToModify, modifications, allEvents);
  }

  /**
   * Clone an event
   */
  async cloneEvent(event: CalendarEvent): Promise<CalendarEvent> {
    return await this.calendarEventsService.cloneCalendarEvent(event);
  }

  /**
   * Update event fields
   */
  async updateEvent(eventId: string, updates: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: Date;
    endTime?: Date;
    isAllDay?: boolean;
    calendarId?: string;
    recurrenceRule?: string;
    recurrenceException?: string[];
    isGroupEvent?: boolean;
    isTaskReservationSpace?: boolean;
    parentGroupEventId?: string;
    taskId?: string;
  }): Promise<CalendarEvent> {
    return await this.calendarEventsService.updateCalendarEvent(eventId, updates);
  }

  /**
   * Move event to another calendar
   */
  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    const existingEvent = await this.calendarEventsService.getCalendarEventById(eventId);
    if (!existingEvent) {
      throw new Error('Event not found');
    }

    return await this.calendarEventsService.updateCalendarEvent(eventId, {
      title: existingEvent.title,
      description: existingEvent.description ?? undefined,
      location: existingEvent.location ?? undefined,
      calendarId: targetCalendarId,
      startTime: existingEvent.start_time,
      endTime: existingEvent.end_time,
      isAllDay: existingEvent.all_day,
      recurrenceRule: existingEvent.recurrence_rule,
      recurrenceException: existingEvent.recurrence_exception,
      isGroupEvent: existingEvent.is_group_event,
      parentGroupEventId: existingEvent.parent_group_event_id,
      taskId: existingEvent.task_id,
    });
  }

  /**
   * Get events in a date range
   */
  async getEventsInRange(startDate: Date, endDate: Date, calendars: Calendar[]): Promise<CalendarEvent[]> {
    try {
      // Get all events
      const allEvents = await this.calendarEventsService.getCalendarEvents(calendars);
      
      // Filter events within the date range
      return allEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        
        // Event overlaps with the range if it starts before range ends and ends after range starts
        return eventStart < endDate && eventEnd > startDate;
      });
    } catch (error) {
      console.error('Failed to get events in range:', error);
      throw new Error('Failed to get events in date range');
    }
  }

  /**
   * Search events by query
   */
  async searchEvents(query: string, calendars: Calendar[]): Promise<CalendarEvent[]> {
    try {
      if (!query.trim()) {
        return [];
      }

      const allEvents = await this.calendarEventsService.getCalendarEvents(calendars);
      const searchLower = query.toLowerCase();
      
      return allEvents.filter(event => {
        return (
          event.title.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.location?.toLowerCase().includes(searchLower)
        );
      });
    } catch (error) {
      console.error('Failed to search events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Create event from task
   */
  async createEventFromTask(task: {
    id: string;
    content: string;
    duration_minutes?: number;
    project_id?: string;
  }, calendarId: string, startTime: Date): Promise<CalendarEvent> {
    try {
      const duration = task.duration_minutes || 60; // Default 1 hour
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      return await this.calendarEventsService.createCalendarEvent({
        title: task.content,
        description: `Task from Can-Do List`,
        calendarId,
        startTime,
        endTime,
        isAllDay: false,
        taskId: task.id
      });
    } catch (error) {
      console.error('Failed to create event from task:', error);
      throw new Error('Failed to create event from task');
    }
  }
}
