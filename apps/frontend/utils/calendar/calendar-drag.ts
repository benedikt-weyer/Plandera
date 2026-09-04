import { differenceInMinutes } from 'date-fns';
import { CalendarEvent } from './calendar-types';

// Enum for different drag modes
export enum DragMode {
  Move = 'move',      // Moving the entire event
  ResizeTop = 'top',  // Resizing the top of the event (changing start time)
  ResizeBottom = 'bottom' // Resizing the bottom of the event (changing end time)
}

export interface DraggedEvent {
  event: CalendarEvent;
  initialPosition: { x: number, y: number };
  offsetY: number;
  mode: DragMode; // Track which operation we're performing
}

export interface DragPosition {
  startTime: Date;
  endTime: Date;
}


/**
 * Calculates the drag position for visual feedback during dragging
 */
export const calculateDraggingEventDateTime = (
  mouseY: number,
  columnMouseOverRect: DOMRect, 
  activeEvent: DraggedEvent,
  slotHeight: number,
  currentlyHoveringDay: Date,
  zoomStartHour: number = 0,
  zoomIntervalMinutes: number = 60
): DragPosition => {

  // Calculate the relative Y position of the mouse within the column
  const relativeY = mouseY - columnMouseOverRect.top - (activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);

  let relativeYSnapped = relativeY;

  if (mouseY < columnMouseOverRect.top) {
    // If the mouse is above the column, snap to the top
    relativeYSnapped = -(activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);
  } else if (mouseY > columnMouseOverRect.bottom) {
    // If the mouse is below the column, snap to the bottom
    relativeYSnapped = columnMouseOverRect.height - (activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);
  }
  
  // Calculate minutes from top position, accounting for zoom offset
  const totalMinutesFromTop = (relativeYSnapped / slotHeight) * zoomIntervalMinutes;
  
  // Add the zoom start hour offset (convert to minutes)
  const totalMinutesFromMidnight = totalMinutesFromTop + (zoomStartHour * 60);
  
  // Round minutes to nearest 15-minute interval for better usability
  const snappedMinutes = Math.round(totalMinutesFromMidnight / 15) * 15;
  
  // Calculate hours and minutes components
  const hours = snappedMinutes >= 0 ? Math.floor(snappedMinutes / 60) : Math.ceil(snappedMinutes / 60);
  const minutes = Math.abs(snappedMinutes % 60);
  
  // Calculate times based on drag mode
  let newStartTime: Date;
  let newEndTime: Date;
  
  switch (activeEvent.mode) {
    case DragMode.ResizeTop: {
      // When resizing from the top, only the start time changes
      newStartTime = new Date(currentlyHoveringDay);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      // Ensure start time doesn't go beyond end time
      const eventEndTime = new Date(activeEvent.event.end_time);
      if (newStartTime >= eventEndTime) {
        newStartTime = new Date(eventEndTime);
        newStartTime.setMinutes(newStartTime.getMinutes() - 15);
      }
      
      newEndTime = eventEndTime;
      break;
    }
      
    case DragMode.ResizeBottom: {
      // When resizing from the bottom, only the end time changes
      newEndTime = new Date(currentlyHoveringDay);
      newEndTime.setHours(hours, minutes, 0, 0);
      
      // Ensure end time doesn't go before start time
      const eventStartTime = new Date(activeEvent.event.start_time);
      if (newEndTime <= eventStartTime) {
        newEndTime = new Date(eventStartTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + 15);
      }
      
      newStartTime = eventStartTime;
      break;
    }
      
    case DragMode.Move:
    default: {
      // Moving the entire event - maintain the same duration
      newStartTime = new Date(currentlyHoveringDay);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      // Calculate duration for maintaining event length
      const eventStartTime = new Date(activeEvent.event.start_time);
      const eventEndTime = new Date(activeEvent.event.end_time);
      const duration = differenceInMinutes(eventEndTime, eventStartTime);
      
      newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + duration);
      break;
    }
  }

  return {
    startTime: newStartTime,
    endTime: newEndTime
  };
};