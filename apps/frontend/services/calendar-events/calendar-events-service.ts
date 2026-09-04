'use client';

import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarEventDecrypted, CreateCalendarEventDecryptedRequest, UpdateCalendarEventDecryptedRequest } from '@/utils/api/types';
import { sortEventsByStartTime, getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { Calendar } from '@/utils/calendar/calendar-types';
import { calculateNextOccurrence, calculatePreviousOccurrence } from '@/utils/calendar/recurrenceHelpers';
import { 
  subDays,
  isSameDay,
  isValid,
  endOfDay
} from 'date-fns';

/**
 * Calendar Events Service - handles all calendar event operations using the decrypted backend
 */
export class CalendarEventsService {
  constructor(private backend: DecryptedBackendInterface) {}

  /**
   * Get all calendar events
   */
  async getCalendarEvents(calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const { data: eventsData } = await this.backend.calendarEvents.getAll();
      
      // The decrypted backend already returns CalendarEventDecrypted objects
      // Since CalendarEvent is an alias for CalendarEventDecrypted, we can return them directly
      return sortEventsByStartTime(eventsData);
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      throw new Error('Failed to load calendar events');
    }
  }

  /**
   * Get a specific calendar event by ID
   */
  async getCalendarEventById(id: string, calendars: Calendar[] = []): Promise<CalendarEvent | null> {
    try {
      const { data: eventData } = await this.backend.calendarEvents.getById(id);
      
      if (!eventData) {
        return null;
      }
      
      // The decrypted backend already returns CalendarEventDecrypted objects
      return eventData;
    } catch (error) {
      console.error(`Failed to fetch calendar event ${id}:`, error);
      throw new Error(`Failed to load calendar event ${id}`);
    }
  }

  /**
   * Create a new calendar event
   */
  async createCalendarEvent(eventData: {
    title: string;
    description?: string;
    location?: string;
    calendarId: string;
    startTime: Date | string;
    endTime: Date | string;
    isAllDay?: boolean;
    recurrenceRule?: string;
    isGroupEvent?: boolean;
    isTaskReservationSpace?: boolean;
    parentGroupEventId?: string;
    taskId?: string;
  }): Promise<CalendarEvent> {
    try {
      // Ensure dates are Date objects
      const startTime = eventData.startTime instanceof Date ? eventData.startTime : new Date(eventData.startTime);
      const endTime = eventData.endTime instanceof Date ? eventData.endTime : new Date(eventData.endTime);

      const createData: CreateCalendarEventDecryptedRequest = {
        title: eventData.title.trim(),
        description: eventData.description?.trim() || '',
        location: eventData.location?.trim() || '',
        calendar_id: eventData.calendarId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        all_day: eventData.isAllDay || false,
        recurrence_rule: eventData.recurrenceRule,
        is_group_event: eventData.isGroupEvent,
        is_task_reservation_space: eventData.isTaskReservationSpace,
        parent_group_event_id: eventData.parentGroupEventId,
        task_id: eventData.taskId,
      };

      const { data: newEvent } = await this.backend.calendarEvents.create(createData);
      
      if (!newEvent) {
        throw new Error('Event creation failed - no data returned');
      }

      return this.mapCalendarEventDecryptedToCalendarEvent(newEvent);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateCalendarEvent(id: string, updates: {
    title?: string;
    description?: string;
    location?: string;
    calendarId?: string;
    startTime?: Date | string;
    endTime?: Date | string;
    isAllDay?: boolean;
    recurrenceRule?: string;
    recurrenceException?: string[];
    isGroupEvent?: boolean;
    isTaskReservationSpace?: boolean;
    parentGroupEventId?: string;
    taskId?: string;
  }): Promise<CalendarEvent> {
    try {
      console.log('updateCalendarEvent called with updates:', updates);
      console.log('updates.calendarId:', updates.calendarId);
      console.log('updates.calendarId !== undefined:', updates.calendarId !== undefined);
      
      const updateData: UpdateCalendarEventDecryptedRequest = {
        id,
        ...(updates.title !== undefined && { title: updates.title.trim() }),
        ...(updates.description !== undefined && { description: updates.description.trim() }),
        ...(updates.location !== undefined && { location: updates.location.trim() }),
        ...(updates.calendarId !== undefined && { calendar_id: updates.calendarId }),
        ...(updates.startTime && { 
          start_time: updates.startTime instanceof Date ? 
            updates.startTime.toISOString() : 
            new Date(updates.startTime).toISOString() 
        }),
        ...(updates.endTime && { 
          end_time: updates.endTime instanceof Date ? 
            updates.endTime.toISOString() : 
            new Date(updates.endTime).toISOString() 
        }),
        ...(updates.isAllDay !== undefined && { all_day: updates.isAllDay }),
        ...(updates.recurrenceRule !== undefined && { recurrence_rule: updates.recurrenceRule }),
        ...(updates.recurrenceException && { recurrence_exception: updates.recurrenceException }),
        ...(updates.isGroupEvent !== undefined && { is_group_event: updates.isGroupEvent }),
        ...(updates.isTaskReservationSpace !== undefined && {
          is_task_reservation_space: updates.isTaskReservationSpace,
        }),
        ...(updates.parentGroupEventId !== undefined && { parent_group_event_id: updates.parentGroupEventId }),
        ...(updates.taskId !== undefined && { task_id: updates.taskId }),
      };

      console.log('CalendarEventsService updateData:', updateData);
      const { data: updatedEvent } = await this.backend.calendarEvents.update(updateData);
      console.log('Backend returned updated event:', updatedEvent);
      
      if (!updatedEvent) {
        throw new Error('Event update failed - no data returned');
      }

      return this.mapCalendarEventDecryptedToCalendarEvent(updatedEvent);
    } catch (error) {
      console.error(`Failed to update calendar event ${id}:`, error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEvent(id: string): Promise<void> {
    try {
      await this.backend.calendarEvents.delete(id);
    } catch (error) {
      console.error(`Failed to delete calendar event ${id}:`, error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Clone a calendar event
   */
  async cloneCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      // Create a copy of the event with a new title and updated timestamps
      const clonedEventData = {
        title: event.title,
        description: event.description,
        location: event.location,
        calendarId: event.calendar_id,
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        isAllDay: event.all_day || false,
        recurrenceRule: event.recurrence_rule,
      };

      return this.createCalendarEvent(clonedEventData);
    } catch (error) {
      console.error('Failed to clone calendar event:', error);
      throw new Error('Failed to clone calendar event');
    }
  }

  /**
   * Move a calendar event to a different calendar
   */
  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    return this.updateCalendarEvent(eventId, { calendarId: targetCalendarId });
  }

  /**
   * Get events for a specific calendar
   */
  async getEventsForCalendar(calendarId: string, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      return allEvents.filter(event => event.calendar_id === calendarId);
    } catch (error) {
      console.error(`Failed to fetch events for calendar ${calendarId}:`, error);
      throw new Error(`Failed to load events for calendar ${calendarId}`);
    }
  }

  /**
   * Get events within a date range
   */
  async getEventsInRange(startDate: Date, endDate: Date, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      return allEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        
        // Event overlaps with the range if:
        // Event starts before range ends AND event ends after range starts
        return eventStart < endDate && eventEnd > startDate;
      });
    } catch (error) {
      console.error('Failed to fetch events in range:', error);
      throw new Error('Failed to load events in date range');
    }
  }

  /**
   * Search events by title or description
   */
  async searchEvents(query: string, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      const searchTerm = query.toLowerCase().trim();
      
      if (!searchTerm) {
        return allEvents;
      }
      
      return allEvents.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description && event.description.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      console.error('Failed to search events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Map CalendarEventDecrypted to CalendarEvent type
   */
  private mapCalendarEventDecryptedToCalendarEvent(eventDecrypted: CalendarEventDecrypted): CalendarEvent {
    // Simply return the event as-is since CalendarEvent is a type alias for CalendarEventDecrypted
    return eventDecrypted;
  }

  // ===== RECURRENCE OPERATIONS =====

  /**
   * Validates the event data for occurrence deletion
   */
  private validateEventForOccurrenceDeletion(eventToDelete: CalendarEvent): { 
    isValid: boolean; 
    occurrenceStartTime?: Date; 
    error?: string; 
  } {
    const recurrencePattern = getRecurrencePattern(eventToDelete);
    if (!recurrencePattern) {
      return { isValid: false, error: 'Missing recurrence pattern' };
    }

    const occurrenceStartTime = (eventToDelete as any).clickedOccurrenceDate ?? new Date(eventToDelete.start_time);

    if (!isValid(occurrenceStartTime)) {
      return { isValid: false, error: "Cannot process delete: invalid event date." };
    }

    const startTime = new Date(eventToDelete.start_time);
    const endTime = new Date(eventToDelete.end_time);
    if (!isValid(startTime) || !isValid(endTime) || endTime <= startTime) {
      return { isValid: false, error: "Cannot process delete: master event data is corrupted." };
    }

    return { isValid: true, occurrenceStartTime };
  }

  /**
   * Updates the original event to end before the deleted occurrence
   */
  private async updateOriginalEventEndDate(
    eventToDelete: CalendarEvent, 
    occurrenceStartTime: Date
  ): Promise<{ success: boolean; newEndDate?: Date; error?: string; deletedOriginal?: boolean }> {
    const recurrencePattern = getRecurrencePattern(eventToDelete);
    if (!recurrencePattern) {
      return { success: false, error: 'Missing recurrence pattern' };
    }

    const newEndOfOriginalEvent = calculatePreviousOccurrence(
      occurrenceStartTime,
      recurrencePattern.frequency,
      recurrencePattern.interval
    );

    if (!isValid(newEndOfOriginalEvent)) {
      return { success: false, error: "Cannot process delete: date calculation error." };
    }

    const startTime = new Date(eventToDelete.start_time);
    // If the calculated end date is before the original start date, 
    // it means we're trying to delete the first occurrence
    if (newEndOfOriginalEvent < startTime) {
      // In this case, we should delete the entire original event instead of updating it
      try {
        await this.backend.calendarEvents.delete(eventToDelete.id);
        return { success: true, newEndDate: newEndOfOriginalEvent, deletedOriginal: true };
      } catch (error) {
        console.error('Failed to delete original event:', error);
        return { success: false, error: "Failed to delete original event in database." };
      }
    }

    // Only update the recurrence rule, not the original event's start/end times
    const updatedOriginalEventData = {
      id: eventToDelete.id,
      title: eventToDelete.title,
      description: eventToDelete.description,
      location: eventToDelete.location,
      calendar_id: eventToDelete.calendar_id,
      start_time: eventToDelete.start_time, // Keep original start time
      end_time: eventToDelete.end_time,     // Keep original end time
      all_day: eventToDelete.all_day || false,
      recurrence_rule: JSON.stringify({
        frequency: recurrencePattern.frequency,
        interval: recurrencePattern.interval,
        end_date: endOfDay(newEndOfOriginalEvent).toISOString(),
        days_of_week: recurrencePattern.daysOfWeek,
      }),
    };
    
    try {
      await this.backend.calendarEvents.update(updatedOriginalEventData);
      return { success: true, newEndDate: newEndOfOriginalEvent };
    } catch (error) {
      console.error('Failed to update original event:', error);
      return { success: false, error: "Failed to update original event in database." };
    }
  }

  /**
   * Creates a new recurring event starting from the next occurrence
   */
  private async createNewRecurringEvent(
    eventToDelete: CalendarEvent,
    occurrenceStartTime: Date,
    originalRecurrenceEndDate?: Date
  ): Promise<{ success: boolean; newEvent?: any; error?: string }> {
    const recurrencePattern = getRecurrencePattern(eventToDelete);
    if (!recurrencePattern) {
      return { success: false, error: 'Missing recurrence pattern' };
    }

    const nextOccurrenceStartTime = calculateNextOccurrence(
      occurrenceStartTime,
      recurrencePattern.frequency,
      recurrencePattern.interval
    );

    if (!isValid(nextOccurrenceStartTime)) {
      return { success: false, error: "Cannot process delete: date calculation error for next occurrence." };
    }

    // If the next occurrence would be after the original end date, no new event needed
    if (originalRecurrenceEndDate && isValid(originalRecurrenceEndDate) && nextOccurrenceStartTime > originalRecurrenceEndDate) {
      return { success: true }; // No new event needed
    }

    // Use the original master event's duration and time, not the modified occurrence's time
    const startTime = new Date(eventToDelete.start_time);
    const endTime = new Date(eventToDelete.end_time);
    const originalEventDuration = endTime.getTime() - startTime.getTime();
    if (originalEventDuration <= 0) {
      return { success: false, error: "Cannot process delete: master event duration invalid." };
    }

    // Create the new series start time using the original event's time of day
    const originalStartTime = new Date(startTime);
    const newSeriesStartTime = new Date(
      nextOccurrenceStartTime.getFullYear(),
      nextOccurrenceStartTime.getMonth(),
      nextOccurrenceStartTime.getDate(),
      originalStartTime.getHours(),
      originalStartTime.getMinutes(),
      originalStartTime.getSeconds(),
      originalStartTime.getMilliseconds()
    );
    
    const newSeriesEndTime = new Date(newSeriesStartTime.getTime() + originalEventDuration);

    if (!isValid(newSeriesEndTime)) { 
      return { success: false, error: "Cannot process delete: date calculation error for new series end time." };
    }

    const newRecurringEventData = {
      title: eventToDelete.title,
      description: eventToDelete.description,
      location: eventToDelete.location,
      calendar_id: eventToDelete.calendar_id,
      start_time: newSeriesStartTime.toISOString(),
      end_time: newSeriesEndTime.toISOString(),
      all_day: eventToDelete.all_day || false,
      recurrence_rule: JSON.stringify({
        frequency: recurrencePattern.frequency,
        interval: recurrencePattern.interval,
        end_date: originalRecurrenceEndDate ? originalRecurrenceEndDate.toISOString() : undefined,
        days_of_week: recurrencePattern.daysOfWeek,
      }),
    };

    try {
      const rawNewEventRecord = await this.backend.calendarEvents.create(newRecurringEventData);

      if (!rawNewEventRecord || !rawNewEventRecord.data) {
        return { success: false, error: "Failed to process event creation: invalid response from server." };
      }

      const newEventRecord = rawNewEventRecord.data;

      return { 
        success: true, 
        newEvent: {
          record: newEventRecord,
          data: newRecurringEventData,
          startTime: newSeriesStartTime,
          endTime: newSeriesEndTime,
          originalRecurrenceEndDate
        }
      };
    } catch (error) {
      console.error('Failed to create new recurring event:', error);
      return { success: false, error: "Failed to create new recurring event." };
    }
  }

  /**
   * Deletes a specific occurrence of a recurring event
   */
  async deleteThisOccurrence(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    // If this is a recurrence instance, find the master event
    let masterEvent = eventToDelete;
    if (eventToDelete.id.includes('-recurrence-')) {
      const masterEventId = eventToDelete.id.split('-recurrence-')[0];
      const foundMasterEvent = allEvents.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        (masterEvent as any).clickedOccurrenceDate = new Date(eventToDelete.start_time);
      } else {
        return { success: false, error: 'Could not find the master recurring event' };
      }
    }

    // Validate event data
    const validation = this.validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      return { success: false, error: validation.error ?? 'Validation failed' };
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    const recurrencePattern = getRecurrencePattern(masterEvent);
    const originalRecurrenceEndDate = recurrencePattern?.endDate ? new Date(recurrencePattern.endDate) : undefined;

    try {
      // Update the original event to end before this occurrence
      const updateResult = await this.updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error ?? 'Failed to update original event' };
      }

      const newEndOfOriginalEvent = updateResult.newEndDate!;

      // Create new recurring event starting from next occurrence
      const createResult = await this.createNewRecurringEvent(masterEvent, occurrenceStartTime, originalRecurrenceEndDate);
      if (!createResult.success) {
        return { success: false, error: createResult.error ?? 'Failed to create new recurring event' };
      }

      // Build updated events list
      let updatedEventsList = allEvents;

      // If the original event was deleted, remove it from the list
      if (updateResult.deletedOriginal) {
        updatedEventsList = allEvents.filter(e => e.id !== masterEvent.id);
      } else {
        // Otherwise, update it with the new recurrence rule end date
        const updatedRecurrenceRule = recurrencePattern ? JSON.stringify({
          frequency: recurrencePattern.frequency,
          interval: recurrencePattern.interval,
          end_date: endOfDay(newEndOfOriginalEvent).toISOString(),
          days_of_week: recurrencePattern.daysOfWeek,
        }) : masterEvent.recurrence_rule;

        const modifiedOriginalEvent: CalendarEvent = {
          ...masterEvent,
          id: masterEvent.id,
          recurrence_rule: updatedRecurrenceRule,
          updated_at: new Date().toISOString(),
        };

        updatedEventsList = allEvents.map(e =>
          e.id === masterEvent.id ? modifiedOriginalEvent : e
        );
      }

      // Add new event if created
      if (createResult.newEvent) {
        const { record, data, startTime, endTime, originalRecurrenceEndDate: endDate } = createResult.newEvent;
        
        const recurrenceRule = JSON.parse(data.recurrence_rule);
        const newLocalEvent: CalendarEvent = {
          id: record.id,
          title: data.title,
          description: data.description,
          calendar_id: data.calendar_id,
          user_id: record.user_id,
          all_day: data.all_day,
          start_time: startTime.toISOString(), 
          end_time: endTime.toISOString(),
          recurrence_rule: data.recurrence_rule,
          created_at: record.created_at, 
          updated_at: record.updated_at || new Date().toISOString(),
        };

        updatedEventsList = [...updatedEventsList, newLocalEvent];
      }
      
      return { 
        success: true, 
        updatedEvents: updatedEventsList.filter(event => isValid(new Date(event.start_time)))
      };
    } catch (error) {
      console.error('Failed to delete this event occurrence:', error);
      return { success: false, error: 'Failed to delete this event occurrence.' };
    }
  }

  /**
   * Deletes this and all future occurrences of a recurring event
   */
  async deleteThisAndFuture(eventToDelete: CalendarEvent, allEvents: CalendarEvent[]): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    const recurrencePattern = getRecurrencePattern(eventToDelete);
    if (!recurrencePattern) {
      return { success: false, error: 'Event is not recurring' };
    }

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToDelete;
    let masterEventId = eventToDelete.id;
    if (eventToDelete.id.includes('-recurrence-')) {
      masterEventId = eventToDelete.id.split('-recurrence-')[0];
      const foundMasterEvent = allEvents.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        (masterEvent as any).clickedOccurrenceDate = new Date(eventToDelete.start_time);
      } else {
        return { success: false, error: 'Could not find the master recurring event' };
      }
    }

    const occurrenceDateForFutureDelete = (masterEvent as any).clickedOccurrenceDate ?? new Date(masterEvent.start_time);

    if (!isValid(occurrenceDateForFutureDelete)) {
      return { success: false, error: "Cannot process delete: invalid event date." };
    }

    const newEndDate = subDays(occurrenceDateForFutureDelete, 1);

    if (!isValid(newEndDate)) {
      return { success: false, error: "Cannot process delete: date calculation error." };
    }

    const masterStartTime = new Date(masterEvent.start_time);
    if (isSameDay(masterStartTime, occurrenceDateForFutureDelete)) {
      // If deleting from the start, delete the entire series
      try {
        await this.backend.calendarEvents.delete(masterEventId);
        return { 
          success: true, 
          updatedEvents: allEvents.filter(e => e.id !== masterEventId)
        };
      } catch (error) {
        return { success: false, error: 'Failed to delete entire event series' };
      }
    }

    try {
      const masterEndTime = new Date(masterEvent.end_time);
      const eventData = {
        id: masterEventId,
        title: masterEvent.title,
        description: masterEvent.description,
        location: masterEvent.location,
        calendar_id: masterEvent.calendar_id,
        start_time: masterStartTime.toISOString(),
        end_time: masterEndTime.toISOString(),
        all_day: masterEvent.all_day || false,
        recurrence_rule: JSON.stringify({
          frequency: recurrencePattern.frequency,
          interval: recurrencePattern.interval,
          end_date: endOfDay(newEndDate).toISOString(),
          days_of_week: recurrencePattern.daysOfWeek,
        }),
      };
      
      await this.backend.calendarEvents.update(eventData);

      // Create the updated recurrence rule that was saved to the database
      const updatedRecurrenceRule = JSON.stringify({
        frequency: recurrencePattern.frequency,
        interval: recurrencePattern.interval,
        end_date: endOfDay(newEndDate).toISOString(),
        days_of_week: recurrencePattern.daysOfWeek,
      });

      const updatedEvents = allEvents.map(e =>
        e.id === masterEventId
          ? {
              ...e,
              recurrence_rule: updatedRecurrenceRule,
              updated_at: new Date().toISOString(),
            }
          : e
      ).filter(event => isValid(new Date(event.start_time)));
      
      return { success: true, updatedEvents };
    } catch (error) {
      console.error('Error deleting this and future events:', error);
      return { success: false, error: 'Failed to delete this and future events.' };
    }
  }

  /**
   * Modifies only a specific occurrence of a recurring event
   */
  async modifyThisOccurrence(
    eventToModify: CalendarEvent,
    modifiedEventData: any,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    let isVirtualRecurrenceInstance = false;
    if (eventToModify.id.includes('-recurrence-')) {
      isVirtualRecurrenceInstance = true;
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = allEvents.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        (masterEvent as any).clickedOccurrenceDate = new Date(eventToModify.start_time);
      } else {
        return { success: false, error: 'Could not find the master recurring event' };
      }
    }

    // Check if this is a child event of a recurring group (not a recurring event itself)
    const recurrencePattern = getRecurrencePattern(masterEvent);
    const isRecurringEvent = recurrencePattern && recurrencePattern.frequency !== 'none';
    
    // If this is a virtual instance of a child event in a recurring group (not a recurring event itself),
    // just update the master child event directly for "this occurrence"
    if (isVirtualRecurrenceInstance && !isRecurringEvent && masterEvent.parent_group_event_id) {
      try {
        // For child events in recurring groups, update the base child event
        // This will affect this occurrence only in the UI, but update the underlying child event
        let newStartTime: Date;
        let newEndTime: Date;
        
        if (modifiedEventData.startDate && modifiedEventData.startTime) {
          newStartTime = new Date(`${modifiedEventData.startDate}T${modifiedEventData.startTime}`);
          newEndTime = new Date(`${modifiedEventData.endDate}T${modifiedEventData.endTime}`);
        } else if (modifiedEventData.start_time && modifiedEventData.end_time) {
          newStartTime = new Date(modifiedEventData.start_time);
          newEndTime = new Date(modifiedEventData.end_time);
        } else {
          newStartTime = new Date(eventToModify.start_time);
          const duration = new Date(masterEvent.end_time).getTime() - new Date(masterEvent.start_time).getTime();
          newEndTime = new Date(newStartTime.getTime() + duration);
        }

        const updateData = {
          id: masterEvent.id,
          ...(modifiedEventData.title !== undefined && { title: modifiedEventData.title }),
          ...(modifiedEventData.description !== undefined && { description: modifiedEventData.description }),
          ...(modifiedEventData.location !== undefined && { location: modifiedEventData.location }),
          ...(modifiedEventData.calendarId !== undefined && { calendar_id: modifiedEventData.calendarId }),
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          ...(modifiedEventData.isAllDay !== undefined && { all_day: modifiedEventData.isAllDay }),
          // Preserve parent_group_event_id to maintain the relationship with the group
          parent_group_event_id: masterEvent.parent_group_event_id,
          // Preserve is_group_event flag
          is_group_event: masterEvent.is_group_event || false,
        };

        await this.backend.calendarEvents.update(updateData);

        const updatedEvents = allEvents.map(event =>
          event.id === masterEvent.id
            ? {
                ...event,
                ...updateData,
                updated_at: new Date().toISOString()
              }
            : event
        );

        return { success: true, updatedEvents };
      } catch (error) {
        console.error('Failed to modify child event:', error);
        return { success: false, error: 'Failed to modify child event' };
      }
    }

    // Validate event data (for actual recurring events)
    const validation = this.validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      return { success: false, error: validation.error ?? 'Validation failed' };
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    // recurrencePattern already declared above
    const originalRecurrenceEndDate = recurrencePattern?.endDate ? new Date(recurrencePattern.endDate) : undefined;

    try {
      // Step 1: Update the original event to end before this occurrence
      const updateResult = await this.updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error ?? 'Failed to update original event' };
      }

      // Step 2: Create new recurring event starting from next occurrence (if needed)
      const createResult = await this.createNewRecurringEvent(masterEvent, occurrenceStartTime, originalRecurrenceEndDate);
      if (!createResult.success) {
        return { success: false, error: createResult.error ?? 'Failed to create new recurring event' };
      }

      // Step 3: Create the modified single event
      // Handle different data formats - either from form (startDate/startTime) or direct (start_time)
      let newStartTime: Date;
      let newEndTime: Date;
      
      if (modifiedEventData.startDate && modifiedEventData.startTime) {
        // Form data format with separate date and time fields
        newStartTime = new Date(`${modifiedEventData.startDate}T${modifiedEventData.startTime}`);
        newEndTime = new Date(`${modifiedEventData.endDate}T${modifiedEventData.endTime}`);
      } else if (modifiedEventData.start_time && modifiedEventData.end_time) {
        // Direct format with combined datetime fields
        newStartTime = new Date(modifiedEventData.start_time);
        newEndTime = new Date(modifiedEventData.end_time);
      } else {
        // Fallback to the occurrence time if no new times provided
        newStartTime = new Date(occurrenceStartTime);
        // Calculate end time based on original event duration
        const originalDuration = new Date(masterEvent.end_time).getTime() - new Date(masterEvent.start_time).getTime();
        newEndTime = new Date(newStartTime.getTime() + originalDuration);
      }
      
      // Validate the parsed dates
      if (!isValid(newStartTime) || !isValid(newEndTime)) {
        return { success: false, error: 'Invalid date/time values provided' };
      }

      const singleEventData = {
        title: modifiedEventData.title ?? masterEvent.title,
        description: modifiedEventData.description ?? masterEvent.description ?? '',
        location: modifiedEventData.location ?? masterEvent.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
        is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
        parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id
      };

      const rawSingleEventRecord = await this.backend.calendarEvents.create(singleEventData);

      if (!rawSingleEventRecord || !rawSingleEventRecord.data) {
        return { success: false, error: "Failed to process single event creation: invalid response from server." };
      }

      const singleEventRecord = rawSingleEventRecord.data;

      // Update events list with all changes
      let updatedEvents = allEvents.map(event => {
        if (event.id === masterEvent.id) {
          // Update original event with new recurrence rule that ends before the occurrence
          const newEndDate = updateResult.newEndDate;
          return {
            ...event,
            recurrence_rule: JSON.stringify({
              frequency: recurrencePattern!.frequency,
              interval: recurrencePattern!.interval,
              end_date: newEndDate ? endOfDay(newEndDate).toISOString() : undefined,
              days_of_week: recurrencePattern!.daysOfWeek,
            }),
            updated_at: new Date().toISOString()
          };
        }
        return event;
      });

      // Add the single modified event
      const newSingleEvent: CalendarEvent = {
        id: singleEventRecord.id,
        title: modifiedEventData.title ?? masterEvent.title,
        description: modifiedEventData.description ?? masterEvent.description ?? '',
        location: modifiedEventData.location ?? masterEvent.location ?? '',
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
        user_id: singleEventRecord.user_id,
        all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
        created_at: singleEventRecord.created_at,
        updated_at: singleEventRecord.updated_at || new Date().toISOString(),
        // Preserve group event properties
        is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
        parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id
      };
      updatedEvents.push(newSingleEvent);

      // Add the new recurring event if it was created
      if (createResult.newEvent) {
        const newRecurringEvent: CalendarEvent = {
          id: createResult.newEvent.record.id,
          title: masterEvent.title,
          description: masterEvent.description ?? '',
          location: masterEvent.location ?? '',
          start_time: createResult.newEvent.startTime.toISOString(),
          end_time: createResult.newEvent.endTime.toISOString(),
          calendar_id: masterEvent.calendar_id,
          user_id: createResult.newEvent.record.user_id,
          all_day: masterEvent.all_day || false,
          recurrence_rule: createResult.newEvent.data.recurrence_rule,
          created_at: createResult.newEvent.record.created_at,
          updated_at: createResult.newEvent.record.updated_at || new Date().toISOString(),
          // Preserve group event properties from master
          is_group_event: masterEvent.is_group_event ?? false,
          parent_group_event_id: masterEvent.parent_group_event_id
        };
        updatedEvents.push(newRecurringEvent);
      }

      return { 
        success: true, 
        updatedEvents: updatedEvents.filter(event => isValid(new Date(event.start_time)))
      };
    } catch (error) {
      console.error('Failed to modify this occurrence:', error);
      return { success: false, error: 'Failed to modify this occurrence' };
    }
  }

  /**
   * Modifies this and future occurrences of a recurring event
   */
  async modifyThisAndFuture(
    eventToModify: CalendarEvent,
    modifiedEventData: any,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    let isVirtualRecurrenceInstance = false;
    if (eventToModify.id.includes('-recurrence-')) {
      isVirtualRecurrenceInstance = true;
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = allEvents.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        (masterEvent as any).clickedOccurrenceDate = new Date(eventToModify.start_time);
      } else {
        return { success: false, error: 'Could not find the master recurring event' };
      }
    }

    // Check if this is a child event of a recurring group (not a recurring event itself)
    const recurrencePattern = getRecurrencePattern(masterEvent);
    const isRecurringEvent = recurrencePattern && recurrencePattern.frequency !== 'none';
    
    // If this is a virtual instance of a child event in a recurring group (not a recurring event itself),
    // just update the master child event directly for "this and future"
    if (isVirtualRecurrenceInstance && !isRecurringEvent && masterEvent.parent_group_event_id) {
      try {
        // For child events in recurring groups, update the base child event
        // This will affect all future occurrences in the UI
        let newStartTime: Date;
        let newEndTime: Date;
        
        if (modifiedEventData.startDate && modifiedEventData.startTime) {
          newStartTime = new Date(`${modifiedEventData.startDate}T${modifiedEventData.startTime}`);
          newEndTime = new Date(`${modifiedEventData.endDate}T${modifiedEventData.endTime}`);
        } else if (modifiedEventData.start_time && modifiedEventData.end_time) {
          newStartTime = new Date(modifiedEventData.start_time);
          newEndTime = new Date(modifiedEventData.end_time);
        } else {
          newStartTime = new Date(eventToModify.start_time);
          const duration = new Date(masterEvent.end_time).getTime() - new Date(masterEvent.start_time).getTime();
          newEndTime = new Date(newStartTime.getTime() + duration);
        }

        const updateData = {
          id: masterEvent.id,
          ...(modifiedEventData.title !== undefined && { title: modifiedEventData.title }),
          ...(modifiedEventData.description !== undefined && { description: modifiedEventData.description }),
          ...(modifiedEventData.location !== undefined && { location: modifiedEventData.location }),
          ...(modifiedEventData.calendarId !== undefined && { calendar_id: modifiedEventData.calendarId }),
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          ...(modifiedEventData.isAllDay !== undefined && { all_day: modifiedEventData.isAllDay }),
          // Preserve parent_group_event_id to maintain the relationship with the group
          parent_group_event_id: masterEvent.parent_group_event_id,
          // Preserve is_group_event flag
          is_group_event: masterEvent.is_group_event || false,
        };

        await this.backend.calendarEvents.update(updateData);

        const updatedEvents = allEvents.map(event =>
          event.id === masterEvent.id
            ? {
                ...event,
                ...updateData,
                updated_at: new Date().toISOString()
              }
            : event
        );

        return { success: true, updatedEvents };
      } catch (error) {
        console.error('Failed to modify child event:', error);
        return { success: false, error: 'Failed to modify child event' };
      }
    }

    // Validate event data (for actual recurring events)
    const validation = this.validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      return { success: false, error: validation.error ?? 'Validation failed' };
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    // recurrencePattern already declared above
    const originalRecurrenceEndDate = recurrencePattern?.endDate ? new Date(recurrencePattern.endDate) : undefined;

    try {
      // Step 1: Update the original event to end before this occurrence
      const updateResult = await this.updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error ?? 'Failed to update original event' };
      }

      // Step 2: Create new recurring event with modified data starting from this occurrence
      // Handle different data formats - either from form (startDate/startTime) or direct (start_time)
      let newSeriesStartTime: Date;
      let newSeriesEndTime: Date;
      
      if (modifiedEventData.startDate && modifiedEventData.startTime) {
        // Form data format with separate date and time fields
        newSeriesStartTime = new Date(`${modifiedEventData.startDate}T${modifiedEventData.startTime}`);
        newSeriesEndTime = new Date(`${modifiedEventData.endDate}T${modifiedEventData.endTime}`);
      } else if (modifiedEventData.start_time && modifiedEventData.end_time) {
        // Direct format with combined datetime fields
        newSeriesStartTime = new Date(modifiedEventData.start_time);
        newSeriesEndTime = new Date(modifiedEventData.end_time);
      } else {
        // Fallback to the occurrence time if no new times provided
        newSeriesStartTime = new Date(occurrenceStartTime);
        // Calculate end time based on original event duration
        const originalDuration = new Date(masterEvent.end_time).getTime() - new Date(masterEvent.start_time).getTime();
        newSeriesEndTime = new Date(newSeriesStartTime.getTime() + originalDuration);
      }
      
      // Validate the parsed dates
      if (!isValid(newSeriesStartTime) || !isValid(newSeriesEndTime)) {
        return { success: false, error: 'Invalid date/time values provided' };
      }

      // Calculate the date offset to apply to the recurrence end date
      const originalOccurrenceDate = new Date(occurrenceStartTime);
      const originalDateOnly = new Date(Date.UTC(originalOccurrenceDate.getUTCFullYear(), originalOccurrenceDate.getUTCMonth(), originalOccurrenceDate.getUTCDate()));
      const newDateOnly = new Date(Date.UTC(newSeriesStartTime.getUTCFullYear(), newSeriesStartTime.getUTCMonth(), newSeriesStartTime.getUTCDate()));
      const dateOffsetMs = newDateOnly.getTime() - originalDateOnly.getTime();

      // Adjust the recurrence end date by the same offset
      const adjustedRecurrenceEndDate = originalRecurrenceEndDate && dateOffsetMs !== 0
        ? new Date(originalRecurrenceEndDate.getTime() + dateOffsetMs)
        : originalRecurrenceEndDate;

      const newRecurringEventData = {
        title: modifiedEventData.title ?? masterEvent.title,
        description: modifiedEventData.description ?? masterEvent.description ?? '',
        location: modifiedEventData.location ?? masterEvent.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
        start_time: newSeriesStartTime.toISOString(),
        end_time: newSeriesEndTime.toISOString(),
        all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
        is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
        parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id,
        recurrence_rule: JSON.stringify({
          frequency: recurrencePattern!.frequency,
          interval: recurrencePattern!.interval,
          end_date: adjustedRecurrenceEndDate ? adjustedRecurrenceEndDate.toISOString() : undefined,
          days_of_week: recurrencePattern!.daysOfWeek,
        }),
      };

      const rawNewEventRecord = await this.backend.calendarEvents.create(newRecurringEventData);

      if (!rawNewEventRecord || !rawNewEventRecord.data) {
        return { success: false, error: "Failed to process event creation: invalid response from server." };
      }

      const newEventRecord = rawNewEventRecord.data;

      // Update events list with all changes
      let updatedEvents = allEvents.map(event => {
        if (event.id === masterEvent.id) {
          // Update original event with new recurrence rule that ends before the occurrence
          const newEndDate = updateResult.newEndDate;
          return {
            ...event,
            recurrence_rule: JSON.stringify({
              frequency: recurrencePattern!.frequency,
              interval: recurrencePattern!.interval,
              end_date: newEndDate ? endOfDay(newEndDate).toISOString() : undefined,
              days_of_week: recurrencePattern!.daysOfWeek,
            }),
            updated_at: new Date().toISOString()
          };
        }
        return event;
      });

      // Add the new modified recurring event
      const newRecurringEvent: CalendarEvent = {
        id: newEventRecord.id,
        title: modifiedEventData.title ?? masterEvent.title,
        description: modifiedEventData.description ?? masterEvent.description ?? '',
        location: modifiedEventData.location ?? masterEvent.location ?? '',
        start_time: newSeriesStartTime.toISOString(),
        end_time: newSeriesEndTime.toISOString(),
        calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
        user_id: newEventRecord.user_id,
        all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
        recurrence_rule: newRecurringEventData.recurrence_rule,
        created_at: newEventRecord.created_at,
        updated_at: newEventRecord.updated_at || new Date().toISOString(),
        // Preserve group event properties
        is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
        parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id
      };
      updatedEvents.push(newRecurringEvent);

      return { 
        success: true, 
        updatedEvents: updatedEvents.filter(event => isValid(new Date(event.start_time)))
      };
    } catch (error) {
      console.error('Failed to modify this and future occurrences:', error);
      return { success: false, error: 'Failed to modify this and future occurrences' };
    }
  }

  /**
   * Modifies all occurrences in the series
   */
  async modifyAllInSeries(
    eventToModify: CalendarEvent,
    modifiedEventData: any,
    allEvents: CalendarEvent[]
  ): Promise<{
    success: boolean;
    updatedEvents?: CalendarEvent[];
    error?: string;
  }> {
    
    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    let originalEventBeingModified = eventToModify; // Keep reference to the original event being modified
    
    if (eventToModify.id.includes('-recurrence-')) {
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = allEvents.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
      } else {
        return { success: false, error: 'Could not find the master recurring event' };
      }
    }

    try {
      // Get the recurrence pattern first
      const recurrencePattern = getRecurrencePattern(masterEvent);
      
      // Handle different data formats - either from form (startDate/startTime) or direct (start_time)
      let newStartTime: Date;
      let newEndTime: Date;
      
      
      if (modifiedEventData.startDate && modifiedEventData.startTime) {
        // Form data format with separate date and time fields
        newStartTime = new Date(`${modifiedEventData.startDate}T${modifiedEventData.startTime}`);
        newEndTime = new Date(`${modifiedEventData.endDate}T${modifiedEventData.endTime}`);
      } else if (modifiedEventData.start_time && modifiedEventData.end_time) {
        // Direct format with combined datetime fields
        newStartTime = new Date(modifiedEventData.start_time);
        newEndTime = new Date(modifiedEventData.end_time);
      } else {
        // Fallback to original event times if no new times provided
        newStartTime = new Date(masterEvent.start_time);
        newEndTime = new Date(masterEvent.end_time);
      }
      
      // Validate the parsed dates
      if (!isValid(newStartTime) || !isValid(newEndTime)) {
        return { success: false, error: 'Invalid date/time values provided' };
      }
      
      // For "modify all in series", calculate the date and time changes
      // Use the original event being modified (before drag) to get the original time
      const originalStartDate = new Date(originalEventBeingModified.start_time);
      
      // Calculate the time difference to maintain event duration
      const timeDifference = newEndTime.getTime() - newStartTime.getTime();
      
      // For drag operations, we need to detect if the user moved the event to a different day
      // by comparing the original event's date (before drag) with the new date (using UTC to avoid timezone issues)
      const originalDateOnly = new Date(Date.UTC(originalStartDate.getUTCFullYear(), originalStartDate.getUTCMonth(), originalStartDate.getUTCDate()));
      const newDateOnly = new Date(Date.UTC(newStartTime.getUTCFullYear(), newStartTime.getUTCMonth(), newStartTime.getUTCDate()));
      const dateOffsetMs = newDateOnly.getTime() - originalDateOnly.getTime();
      
      // If this is a drag operation and the event was moved to a different day,
      // we need to update the master event's date accordingly
      let updatedStartTime: Date;
      let updatedEndTime: Date;
      
      if (dateOffsetMs !== 0) {
        // Event was moved to a different day - use the new date and time directly
        // but apply the date offset to the master event's original date with the new time
        const masterStartTime = new Date(masterEvent.start_time);
        
        // Use the new time from the drag operation, but apply it to the master event's date + offset
        const newMasterDate = new Date(masterStartTime.getTime() + dateOffsetMs);
        
        updatedStartTime = new Date(
          newMasterDate.getFullYear(),
          newMasterDate.getMonth(),
          newMasterDate.getDate(),
          newStartTime.getHours(),
          newStartTime.getMinutes(),
          newStartTime.getSeconds(),
          newStartTime.getMilliseconds()
        );
        updatedEndTime = new Date(updatedStartTime.getTime() + timeDifference);
        
      } else {
        // Event was moved within the same day or time was changed - preserve original date but update time
        const masterStartTime = new Date(masterEvent.start_time);
        updatedStartTime = new Date(
          masterStartTime.getFullYear(),
          masterStartTime.getMonth(),
          masterStartTime.getDate(),
          newStartTime.getHours(),
          newStartTime.getMinutes(),
          newStartTime.getSeconds(),
          newStartTime.getMilliseconds()
        );
        updatedEndTime = new Date(updatedStartTime.getTime() + timeDifference);
      }
      const eventData = {
        id: masterEvent.id,
        title: modifiedEventData.title ?? masterEvent.title,
        description: modifiedEventData.description ?? masterEvent.description ?? '',
        location: modifiedEventData.location ?? masterEvent.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
        start_time: updatedStartTime.toISOString(),
        end_time: updatedEndTime.toISOString(),
        all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
        is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
        parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id,
        recurrence_rule: JSON.stringify({
          frequency: modifiedEventData.recurrenceFrequency ?? recurrencePattern?.frequency ?? 'none',
          end_date: 'recurrenceEndDate' in modifiedEventData
            ? (modifiedEventData.recurrenceEndDate && modifiedEventData.recurrenceEndDate.trim() !== '' 
                ? new Date(modifiedEventData.recurrenceEndDate).toISOString() 
                : undefined)
            : (recurrencePattern?.endDate 
                ? new Date(recurrencePattern.endDate.getTime() + dateOffsetMs).toISOString()
                : undefined),
          interval: modifiedEventData.recurrenceInterval ?? recurrencePattern?.interval ?? 1,
          days_of_week: recurrencePattern?.daysOfWeek
        })
      };

      await this.backend.calendarEvents.update(eventData);

      // Update state
      const updatedEvents = allEvents.map(event =>
        event.id === masterEvent.id ? {
          ...event,
          title: modifiedEventData.title ?? masterEvent.title,
          description: modifiedEventData.description ?? masterEvent.description ?? '',
          location: modifiedEventData.location ?? masterEvent.location ?? '',
          calendar_id: modifiedEventData.calendarId ?? modifiedEventData.calendar_id ?? masterEvent.calendar_id,
          start_time: updatedStartTime.toISOString(),
          end_time: updatedEndTime.toISOString(),
          all_day: modifiedEventData.isAllDay ?? modifiedEventData.all_day ?? masterEvent.all_day ?? false,
          is_group_event: modifiedEventData.isGroupEvent ?? modifiedEventData.is_group_event ?? masterEvent.is_group_event ?? false,
          parent_group_event_id: modifiedEventData.parentGroupEventId ?? modifiedEventData.parent_group_event_id ?? masterEvent.parent_group_event_id,
          recurrence_rule: JSON.stringify({
            frequency: modifiedEventData.recurrenceFrequency ?? recurrencePattern?.frequency ?? 'none',
            end_date: 'recurrenceEndDate' in modifiedEventData
              ? (modifiedEventData.recurrenceEndDate && modifiedEventData.recurrenceEndDate.trim() !== '' 
                  ? new Date(modifiedEventData.recurrenceEndDate).toISOString() 
                  : undefined)
              : (recurrencePattern?.endDate 
                  ? new Date(recurrencePattern.endDate.getTime() + dateOffsetMs).toISOString() 
                  : undefined),
            interval: modifiedEventData.recurrenceInterval ?? recurrencePattern?.interval ?? 1,
            days_of_week: recurrencePattern?.daysOfWeek
          }),
          updated_at: new Date().toISOString()
        } : event
      );

      return { success: true, updatedEvents };
    } catch (error) {
      console.error('Failed to modify all in series:', error);
      return { success: false, error: 'Failed to modify all events in series' };
    }
  }
}

// No singleton export - services should be instantiated with backend dependency
