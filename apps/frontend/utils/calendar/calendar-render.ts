import { format, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { CalendarEvent } from './calendar-types';

export interface CalendarEventRendering {
  eventStyles: {
    top: string;
    height: string;
    width: string;
    left: string;
    zIndex: number;
    opacity: number;
  };
  startTime: Date;
  endTime: Date;
}

/**
 * Calculates event rendering details for an event within a specific day
 */
export const calculateEventRendering = (
  event: CalendarEvent,
  day: Date,
  slotHeight: number,
  zIndex: number,
  opacity: number,
  columnIndex: number = 0,
  totalColumns: number = 1
): CalendarEventRendering => {
  // Adjust times for events that cross days
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  
  const eventStart = isSameDay(startTime, day) 
    ? startTime 
    : setHours(setMinutes(new Date(day), 0), 0); // Start of day if crossing from previous day
  
  const eventEnd = isSameDay(endTime, day) 
    ? endTime 
    : setHours(setMinutes(new Date(day), 0), 24); // End of day if crossing to next day
  
  // Calculate position from top (based on start time)
  const dayStartTime = setHours(setMinutes(new Date(day), 0), 0); // 00:00
  const minutesFromDayStart = differenceInMinutes(eventStart, dayStartTime);
  const topPosition = (minutesFromDayStart / 60) * slotHeight;
  
  // Calculate height (based on duration)
  const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
  const height = (durationInMinutes / 60) * slotHeight;
  
  // Calculate width and left position for overlapping events
  const columnWidth = 100 / totalColumns;
  const leftPosition = columnWidth * columnIndex;
  
  return {
    eventStyles: {
      top: `${topPosition}px`,
      height: `${height}px`,
      width: totalColumns > 1 ? `calc(${columnWidth}% - 4px)` : 'calc(100% - 8px)',
      left: totalColumns > 1 ? `${leftPosition}%` : '4px',
      zIndex: zIndex,
      opacity: opacity/100
    },
    startTime: eventStart,
    endTime: eventEnd
  };
};

/**
 * Checks if two events overlap in time
 */
export const doEventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
  const start1 = new Date(event1.start_time);
  const end1 = new Date(event1.end_time);
  const start2 = new Date(event2.start_time);
  const end2 = new Date(event2.end_time);
  
  return start1 < end2 && start2 < end1;
};

/**
 * Groups overlapping events together
 */
export const groupOverlappingEvents = (
  events: CalendarEvent[]
): CalendarEvent[][] => {
  if (!events.length) return [];
  
  // Filter out events with invalid start_time or end_time
  const validEvents = events.filter(event => {
    try {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      return !isNaN(startTime.getTime()) && !isNaN(endTime.getTime());
    } catch {
      return false;
    }
  });
  
  if (validEvents.length === 0) return [];
  
  // Sort events by start time
  const sortedEvents = [...validEvents].sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  
  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [sortedEvents[0]];
  
  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    
    // Check if this event overlaps with any in the current group
    const overlapsWithGroup = currentGroup.some(groupEvent => 
      doEventsOverlap(event, groupEvent)
    );
    
    if (overlapsWithGroup) {
      // Add to current group if it overlaps
      currentGroup.push(event);
    } else {
      // Start a new group if no overlap
      groups.push(currentGroup);
      currentGroup = [event];
    }
  }
  
  // Don't forget to add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
};

export interface EventLayout {
  event: CalendarEvent;
  column: number;
  columnSpan: number;
  totalColumns: number;
}

/**
 * Calculates optimal layout for overlapping events to maximize their width
 * Uses a column-based algorithm similar to Google Calendar
 */
export const calculateEventLayout = (events: CalendarEvent[]): EventLayout[] => {
  if (events.length === 0) return [];
  if (events.length === 1) {
    return [{ event: events[0], column: 0, columnSpan: 1, totalColumns: 1 }];
  }

  // Sort events by start time, then by duration (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    const startDiff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    if (startDiff !== 0) return startDiff;
    // If same start time, longer events first
    const durationA = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
    const durationB = new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
    return durationB - durationA;
  });

  // Build collision matrix - which events overlap with which
  const collisions: boolean[][] = sortedEvents.map((_, i) =>
    sortedEvents.map((_, j) => i !== j && doEventsOverlap(sortedEvents[i], sortedEvents[j]))
  );

  // Calculate the maximum number of overlapping events at any point
  let maxColumns = 0;
  const columns: number[] = new Array(sortedEvents.length).fill(0);

  // Assign each event to a column
  for (let i = 0; i < sortedEvents.length; i++) {
    // Find the leftmost available column
    const occupiedColumns = new Set<number>();
    
    // Check which columns are occupied by events that overlap with this one
    for (let j = 0; j < i; j++) {
      if (collisions[i][j]) {
        occupiedColumns.add(columns[j]);
      }
    }

    // Find the first free column
    let column = 0;
    while (occupiedColumns.has(column)) {
      column++;
    }
    
    columns[i] = column;
    maxColumns = Math.max(maxColumns, column + 1);
  }

  // Calculate column span for each event
  // An event can span multiple columns if no other events occupy those columns during its time
  const layouts: EventLayout[] = sortedEvents.map((event, i) => {
    let columnSpan = 1;
    const eventColumn = columns[i];
    
    // Check how many columns to the right are free during this event's time
    for (let col = eventColumn + 1; col < maxColumns; col++) {
      let columnIsFree = true;
      
      // Check if any event in this column overlaps with our event
      for (let j = 0; j < sortedEvents.length; j++) {
        if (columns[j] === col && collisions[i][j]) {
          columnIsFree = false;
          break;
        }
      }
      
      if (columnIsFree) {
        columnSpan++;
      } else {
        // Stop if we hit an occupied column (no gaps)
        break;
      }
    }

    return {
      event,
      column: eventColumn,
      columnSpan,
      totalColumns: maxColumns
    };
  });

  return layouts;
};

/**
 * Calculates viewport-optimized calendar dimensions
 */
export const calculateCalendarDimensions = (
  timeSlotCount: number,
  minSlotHeight = 25
): { 
  calendarHeight: number, 
  slotHeight: number 
} => {
  // Get viewport height
  const viewportHeight = window.innerHeight;
  // Approximate header heights (page header, calendar header, etc.)
  const headerOffset = 180;
  // Provide some padding at the bottom
  const bottomPadding = 20;
  // Calculate available height
  const availableHeight = viewportHeight - headerOffset - bottomPadding;
  
  // Set height, with a minimum to ensure visibility
  const calendarHeight = Math.max(availableHeight, 500);
  
  // Calculate slot height based on available height and number of slots
  // Subtract a small amount for borders
  const calculatedSlotHeight = Math.max(
    Math.floor((calendarHeight - 2) / timeSlotCount),
    minSlotHeight // Minimum slot height
  );
  
  return {
    calendarHeight,
    slotHeight: calculatedSlotHeight
  };
};