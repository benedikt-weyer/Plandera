import {
  format,
  parse,
  isValid,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  isWithinInterval,
  isSameDay,
  addDays,
  addMonths,
  addYears,
  getDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarEvent,
  Calendar,
  RecurrenceFrequency,
  RecurrencePattern,
} from "./calendar-types";
import { getRecurrencePattern } from "./eventDataProcessing";

// Generate time slots for the calendar (hourly intervals)
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];

  for (let hour = startHour; hour < endHour; hour++) {
    // Format hours with leading zeros for consistency
    const formattedHour = hour.toString().padStart(2, "0");
    slots.push(`${formattedHour}:00`);
  }

  return slots;
};

// Get the days of the current week
export const getDaysOfWeek = (currentWeek: Date, weekStartsOn: 0 | 1 = 1) => {
  return eachDayOfInterval({
    start: currentWeek,
    end: endOfWeek(currentWeek, { weekStartsOn }),
  });
};

// Filter events for the current week
export const filterEventsForWeek = (
  events: CalendarEvent[],
  currentWeek: Date,
  weekStartsOn: 0 | 1 = 1,
) => {
  if (!events.length) return [];

  const weekStart = currentWeek;
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn });

  // Get all events and their recurring instances that fall within this week
  const allEventsForWeek: CalendarEvent[] = [];

  events.forEach((event) => {
    // Check if the original event is in the current week
    const eventStartTime = new Date(event.start_time);
    const eventEndTime = new Date(event.end_time);
    const originalEventInWeek =
      isWithinInterval(eventStartTime, { start: weekStart, end: weekEnd }) ||
      isWithinInterval(eventEndTime, { start: weekStart, end: weekEnd }) ||
      (eventStartTime < weekStart && eventEndTime > weekEnd);

    if (originalEventInWeek) {
      allEventsForWeek.push(event);
    }

    // If this is a recurring event, check for instances in the current week
    const recurrencePattern = getRecurrencePattern(event);
    if (
      recurrencePattern &&
      recurrencePattern.frequency !== RecurrenceFrequency.None
    ) {
      const recurrenceInstances = generateRecurrenceInstancesInRange(
        event,
        weekStart,
        weekEnd,
        recurrencePattern,
      );

      allEventsForWeek.push(...recurrenceInstances);
    }
  });

  return allEventsForWeek;
};

export const filterEventsForMonth = (
  events: CalendarEvent[],
  currentDate: Date,
  weekStartsOn: 0 | 1 = 1,
) => {
  if (!events.length) return [];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const rangeStart = startOfWeek(monthStart, { weekStartsOn });
  const rangeEnd = endOfWeek(monthEnd, { weekStartsOn });

  const allEventsForMonth: CalendarEvent[] = [];

  events.forEach((event) => {
    const eventStartTime = new Date(event.start_time);
    const eventEndTime = new Date(event.end_time);
    const originalEventInRange =
      isWithinInterval(eventStartTime, { start: rangeStart, end: rangeEnd }) ||
      isWithinInterval(eventEndTime, { start: rangeStart, end: rangeEnd }) ||
      (eventStartTime < rangeStart && eventEndTime > rangeEnd);

    if (originalEventInRange) {
      allEventsForMonth.push(event);
    }

    const recurrencePattern = getRecurrencePattern(event);
    if (
      recurrencePattern &&
      recurrencePattern.frequency !== RecurrenceFrequency.None
    ) {
      const recurrenceInstances = generateRecurrenceInstancesInRange(
        event,
        rangeStart,
        rangeEnd,
        recurrencePattern,
      );

      allEventsForMonth.push(...recurrenceInstances);
    }
  });

  return allEventsForMonth;
};

/**
 * Generates recurring instances of an event within a specified date range
 */
export const generateRecurrenceInstancesInRange = (
  baseEvent: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  recurrencePattern: RecurrencePattern,
): CalendarEvent[] => {
  const instances: CalendarEvent[] = [];

  const { frequency, endDate, interval = 1, daysOfWeek } = recurrencePattern;

  // If the original event is after the range end, no need to continue
  const baseEventStartTime = new Date(baseEvent.start_time);
  const baseEventEndTime = new Date(baseEvent.end_time);

  if (baseEventStartTime > rangeEnd) {
    return instances;
  }

  // If an end date is specified and it's before the range start, no events
  if (endDate && endDate < rangeStart) {
    return instances;
  }

  // Calculate the event duration in milliseconds to maintain for each instance
  const eventDuration =
    baseEventEndTime.getTime() - baseEventStartTime.getTime();

  if (
    !isValid(baseEventStartTime) ||
    !isValid(baseEventEndTime) ||
    eventDuration <= 0
  ) {
    console.error(
      "[generateRecurrenceInstancesInRange] Invalid baseEvent startTime, endTime, or duration:",
      JSON.stringify({
        id: baseEvent.id,
        startTime: baseEvent.start_time,
        endTime: baseEvent.end_time,
        duration: eventDuration,
      }),
    );
    return instances; // Return empty if dates are invalid or duration is non-positive
  }

  // Define the maximum date we'll check for recurrences
  // Extend the range to account for multi-day events that might start before rangeStart but end within range
  const maxEventDurationDays = Math.ceil(eventDuration / (24 * 60 * 60 * 1000)); // Convert ms to days
  const extendedRangeEnd = addDays(rangeEnd, maxEventDurationDays);
  const latestDate = endDate
    ? new Date(Math.min(extendedRangeEnd.getTime(), endDate.getTime()))
    : extendedRangeEnd;

  // Generate instances based on frequency
  let currentDate = new Date(baseEventStartTime);

  if (!isValid(currentDate)) {
    console.error(
      "[generateRecurrenceInstancesInRange] Initial currentDate is invalid, derived from baseEvent.start_time:",
      baseEvent.start_time,
    );
    return instances;
  }

  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety break for while loop

  while (currentDate <= latestDate) {
    iterationCount++;

    if (iterationCount > MAX_ITERATIONS) {
      console.error(
        "[generateRecurrenceInstancesInRange] Exceeded MAX_ITERATIONS. Breaking loop. BaseEvent:",
        JSON.stringify(baseEvent, null, 2),
      );
      break;
    }

    const previousCurrentDate = new Date(currentDate); // Store before advancing

    // Skip the original event occurrence
    if (!isSameDay(currentDate, baseEventStartTime)) {
      // Create the instance with same duration as original
      const startTime = new Date(currentDate);
      const endTime = new Date(startTime.getTime() + eventDuration);

      if (!isValid(startTime) || !isValid(endTime)) {
        console.error(
          "[generateRecurrenceInstancesInRange] Invalid startTime or endTime for generated instance:",
          JSON.stringify({
            baseEventId: baseEvent.id,
            currentLoopDate: currentDate,
            instanceStartTime: startTime,
            instanceEndTime: endTime,
          }),
        );
        // Decide: skip this instance or stop? For now, skip.
        continue;
      }

      // Check if this instance overlaps with the desired range (same logic as root events)
      const instanceOverlapsRange =
        isWithinInterval(startTime, { start: rangeStart, end: rangeEnd }) ||
        isWithinInterval(endTime, { start: rangeStart, end: rangeEnd }) ||
        (startTime < rangeStart && endTime > rangeEnd);

      if (instanceOverlapsRange) {
        // For weekly recurrences, check if this day of week should be included
        const shouldInclude =
          frequency !== RecurrenceFrequency.Weekly ||
          !daysOfWeek ||
          daysOfWeek.includes(getDay(currentDate));

        if (shouldInclude) {
          instances.push({
            ...baseEvent,
            id: `${baseEvent.id}-recurrence-${format(startTime, "yyyy-MM-dd")}`,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
          });
        }
      }
    }

    // Advance to next occurrence based on frequency and interval
    switch (frequency) {
      case RecurrenceFrequency.Daily:
        currentDate = addDays(currentDate, interval);
        break;
      case RecurrenceFrequency.Weekly:
        currentDate = addWeeks(currentDate, interval);
        break;
      case RecurrenceFrequency.BiWeekly:
        currentDate = addWeeks(currentDate, 2 * interval);
        break;
      case RecurrenceFrequency.Monthly:
        currentDate = addMonths(currentDate, interval);
        break;
      case RecurrenceFrequency.Yearly:
        currentDate = addYears(currentDate, interval);
        break;
      default:
        // Stop the loop for any unhandled frequencies
        console.error(
          "[generateRecurrenceInstancesInRange] Unhandled frequency in switch. BaseEvent:",
          JSON.stringify(baseEvent, null, 2),
        );
        currentDate = new Date(latestDate.getTime() + 1);
    }

    if (currentDate <= previousCurrentDate) {
      console.error(
        "[generateRecurrenceInstancesInRange] currentDate did not advance. Breaking loop to prevent infinite loop. BaseEvent:",
        JSON.stringify(baseEvent, null, 2),
        {
          previousCurrentDate: previousCurrentDate?.toISOString(),
          currentDate: currentDate?.toISOString(),
          interval,
          frequency,
        },
      );
      break;
    }
  }

  return instances;
};

/**
 * Format validation schema
 */
export const validateTimeRange = (
  startTime: string,
  endTime: string,
): boolean => {
  const start = parse(startTime, "yyyy-MM-dd'T'HH:mm", new Date());
  const end = parse(endTime, "yyyy-MM-dd'T'HH:mm", new Date());
  return isValid(start) && isValid(end) && end > start;
};

// Ensure all events have calendar properties properly set
export const ensureCalendarPropertiesOnEvents = (
  events: CalendarEvent[],
  calendars: Calendar[],
): CalendarEvent[] => {
  if (!events.length || !calendars.length) return events;

  return events.map((event) => {
    // Since CalendarEvent is now CalendarEventDecrypted, we don't need to add calendar objects
    // The calendar information should be looked up separately when needed
    return event;
  });
};
