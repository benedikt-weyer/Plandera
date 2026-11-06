/**
 * Shared helpers for event groups (group events and the child events nested inside them),
 * used by the week, day and month calendar views so that they all display groups the same way.
 */

import type { CSSProperties } from 'react';
import { format, isSameDay } from 'date-fns';

import { CalendarEvent, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';

const RECURRENCE_MARKER = '-recurrence-';

/** The id of the stored event behind a (possibly virtual) recurrence instance. */
export function getBaseEventId(id: string): string {
  return id.includes(RECURRENCE_MARKER) ? id.split(RECURRENCE_MARKER)[0] : id;
}

/**
 * All child events of a group event instance. For an instance of a recurring group, the stored
 * children are shifted by the same offset as the instance so they appear inside it.
 */
export function getChildEventsForGroupInstance(
  groupEvent: CalendarEvent | null,
  allEvents: CalendarEvent[],
): CalendarEvent[] {
  if (!groupEvent) return [];

  const baseGroupEventId = getBaseEventId(groupEvent.id);
  const baseChildEvents = allEvents.filter(e => e.parent_group_event_id === baseGroupEventId);
  const isRecurringInstance = groupEvent.id.includes(RECURRENCE_MARKER);

  if (isRecurringInstance) {
    const recurringGroupStart = new Date(groupEvent.start_time);
    const originalGroupEvent = allEvents.find(e => e.id === baseGroupEventId);
    if (originalGroupEvent) {
      const timeOffset = recurringGroupStart.getTime() - new Date(originalGroupEvent.start_time).getTime();

      return baseChildEvents.map(child => ({
        ...child,
        id: `${child.id}${RECURRENCE_MARKER}${format(recurringGroupStart, 'yyyy-MM-dd')}`,
        start_time: new Date(new Date(child.start_time).getTime() + timeOffset).toISOString(),
        end_time: new Date(new Date(child.end_time).getTime() + timeOffset).toISOString(),
      }));
    }
  }

  return baseChildEvents;
}

/** The child events of a group event instance that fall on the given day. */
export function getGroupChildrenForDay(
  groupEvent: CalendarEvent,
  allEvents: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return getChildEventsForGroupInstance(groupEvent, allEvents).filter(child =>
    isSameDay(new Date(child.start_time), day),
  );
}

/**
 * Whether the event is a child that is shown inside its group instead of on its own.
 * A child whose group is not in `events` (e.g. its calendar is hidden) still shows up by itself.
 */
export function isNestedGroupChild(event: CalendarEvent, events: CalendarEvent[]): boolean {
  const parentId = event.parent_group_event_id;
  if (!parentId) return false;
  return events.some(candidate => getBaseEventId(candidate.id) === parentId);
}

/**
 * The event to open in the edit dialog when a child event is clicked inside its group.
 * A virtual recurrence instance of a child in a recurring group opens its stored event,
 * remembering which occurrence was clicked.
 */
export function resolveGroupChildForEdit(event: CalendarEvent, allEvents: CalendarEvent[]): CalendarEvent {
  if (!event.id.includes(RECURRENCE_MARKER)) return event;

  const masterEvent = allEvents.find(e => e.id === getBaseEventId(event.id));
  if (!masterEvent) return event;

  const parentGroup = masterEvent.parent_group_event_id
    ? allEvents.find(e => e.id === masterEvent.parent_group_event_id)
    : null;
  if (!parentGroup) return event;

  const parentRecurrence = getRecurrencePattern(parentGroup);
  const isParentRecurring = parentRecurrence && parentRecurrence.frequency !== RecurrenceFrequency.None;
  if (!isParentRecurring) return event;

  return {
    ...masterEvent,
    clickedOccurrenceDate: event.start_time,
    isRecurrenceInstance: true,
  } as CalendarEvent;
}

/**
 * Background / border styling of a group event, matching the week view:
 * translucent calendar color, solid border for groups and dashed (striped) for task reservation spaces.
 */
export function getGroupEventStyle(calendarColor: string, isTaskReservationSpace: boolean): CSSProperties {
  return {
    backgroundColor: isTaskReservationSpace ? `${calendarColor}18` : `${calendarColor}20`,
    backgroundImage: isTaskReservationSpace
      ? `repeating-linear-gradient(135deg, ${calendarColor}10 0px, ${calendarColor}10 10px, transparent 10px, transparent 20px)`
      : undefined,
    borderWidth: '2px',
    borderStyle: isTaskReservationSpace ? 'dashed' : 'solid',
    borderColor: calendarColor,
    boxShadow: isTaskReservationSpace ? `inset 0 0 0 1px ${calendarColor}30` : undefined,
  };
}
