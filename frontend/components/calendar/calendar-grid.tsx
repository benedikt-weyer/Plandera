import React, { useEffect, useState, useRef, useCallback } from 'react';

import { format, isSameDay, differenceInMinutes } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { useDateLocale } from '@/utils/context/LanguageContext';
import { useDroppable, useFlexyDND } from '@/lib/flexyDND';
import type { DragData, DragPosition as FlexyDragPosition } from '@/lib/flexyDND';
import { useCalendar } from '@/stores/calendar-store';

import { CalendarEvent, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { generateTimeSlots } from '@/utils/calendar/calendar';
import { calculateCalendarDimensions, calculateEventRendering, groupOverlappingEvents, calculateEventLayout } from '@/utils/calendar/calendar-render';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { 
  DraggedEvent, 
  DragPosition, 
  calculateDraggingEventDateTime,
  DragMode // Import the DragMode enum
} from '@/utils/calendar/calendar-drag';
import { EventGroupModal } from './event-group-modal';

// Helper function to generate virtual child events for recurring group instances
const getChildEventsForGroupInstance = (
  groupEvent: CalendarEvent | null,
  allEvents: CalendarEvent[]
): CalendarEvent[] => {
  if (!groupEvent) return [];
  
  const baseGroupEventId = groupEvent.id.includes('-recurrence-')
    ? groupEvent.id.split('-recurrence-')[0]
    : groupEvent.id;
  
  const baseChildEvents = allEvents.filter(e => e.parent_group_event_id === baseGroupEventId);
  const isRecurringInstance = groupEvent.id.includes('-recurrence-');
  
  if (isRecurringInstance) {
    // For recurring group instances, create virtual child events with adjusted times
    const recurringGroupStart = new Date(groupEvent.start_time);
    
    // Find the original (non-recurring) group event to calculate time offsets
    const originalGroupEvent = allEvents.find(e => e.id === baseGroupEventId);
    if (originalGroupEvent) {
      const originalGroupStartTime = new Date(originalGroupEvent.start_time).getTime();
      const recurringGroupStartTime = recurringGroupStart.getTime();
      const timeOffset = recurringGroupStartTime - originalGroupStartTime;
      
      // Create virtual child events with adjusted times
      return baseChildEvents.map(child => ({
        ...child,
        id: `${child.id}-recurrence-${format(recurringGroupStart, 'yyyy-MM-dd')}`,
        start_time: new Date(new Date(child.start_time).getTime() + timeOffset).toISOString(),
        end_time: new Date(new Date(child.end_time).getTime() + timeOffset).toISOString()
      }));
    }
  }
  
  return baseChildEvents;
};


// -------- DayColumn Component --------
interface DayColumnProps {
  day: Date;
  dayIndex: number;
  calendarHeight: number | null;
  slotHeight: number;
  timeSlots: any[];
  isZoomActive: boolean;
  zoomWindow: { startHour: number; endHour: number; windowHeight: number };
  renderCurrentTimeLine: (day: Date) => React.ReactNode;
  renderEvents: (day: Date, dayIndex: number) => React.ReactNode;
  renderDragHelper: (dayIndex: number, day: Date, dragPosition: DragPosition | null) => React.ReactNode;
  handleDayClick: (day: Date, e: React.MouseEvent<HTMLDivElement>) => void;
  dropHoverPosition: { day: Date; time: Date } | null;
  onTaskDrop?: (taskId: string, startTime: Date, durationMinutes: number) => Promise<void>;
  calculateTimeFromPosition: (day: Date, position: FlexyDragPosition, dayElement: HTMLElement) => Date;
  setDropHoverPosition: React.Dispatch<React.SetStateAction<{ day: Date; time: Date } | null>>;
  currentDragData: any;
  dragPosition: DragPosition | null;
}

function DayColumn({
  day,
  dayIndex,
  calendarHeight,
  slotHeight,
  timeSlots,
  isZoomActive,
  zoomWindow,
  renderCurrentTimeLine,
  renderEvents,
  renderDragHelper,
  handleDayClick,
  dropHoverPosition,
  onTaskDrop,
  calculateTimeFromPosition,
  setDropHoverPosition,
  currentDragData,
  dragPosition,
}: DayColumnProps) {
  const dayColumnRef = useRef<HTMLDivElement | null>(null);
  
  const handleDrop = useCallback(async (dragData: DragData, position: FlexyDragPosition) => {
    if (dayColumnRef.current && onTaskDrop) {
      const dropTime = calculateTimeFromPosition(day, position, dayColumnRef.current);
      const taskData = dragData.data;
      try {
        await onTaskDrop(taskData.taskId, dropTime, taskData.durationMinutes || 60);
      } catch (error) {
        console.error('Task drop failed:', error);
      }
      setDropHoverPosition(null);
    }
  }, [day, onTaskDrop, calculateTimeFromPosition, setDropHoverPosition]);

  const handleDragOver = useCallback((dragData: DragData, position: FlexyDragPosition) => {
    if (dayColumnRef.current) {
      const dropTime = calculateTimeFromPosition(day, position, dayColumnRef.current);
      setDropHoverPosition({ day, time: dropTime });
    }
  }, [day, calculateTimeFromPosition, setDropHoverPosition]);

  const handleDragLeave = useCallback(() => {
    setDropHoverPosition(null);
  }, [setDropHoverPosition]);

  const { dropRef } = useDroppable({
    id: `calendar-day-${format(day, 'yyyy-MM-dd')}`,
    accept: 'task',
    onDrop: handleDrop,
    onDragEnter: () => {},
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
  });

  return (
    <div 
      ref={(el) => {
        dayColumnRef.current = el;
        (dropRef as any).current = el;
      }}
      className="relative border-r last:border-r-0 day-column"
      onClick={(e) => handleDayClick(day, e)}
      style={{ height: calendarHeight ? `${calendarHeight}px` : `${slotHeight * timeSlots.length}px` }}
      data-date={format(day, "yyyy-MM-dd")}
    >
      {/* Time slot lines */}
      {timeSlots.map((slot, i) => {
        const timeString = typeof slot === 'string' ? slot : slot.time;
        const isMain = typeof slot === 'string' ? true : slot.isMain;
        
        return (
          <div 
            key={`slot-${day.toISOString()}-${i}`}
            className={`absolute border-b w-full ${
              isMain ? 'border-border' : 'border-border/30'
            }`}
            style={{ 
              top: `${i * slotHeight}px`,
              height: `${slotHeight}px` 
            }}
          />
        );
      })}
      
      {/* Current time indicator line */}
      {renderCurrentTimeLine(day)}
      
      {/* Events for this day */}
      {renderEvents(day, dayIndex)}
      
      {/* Drag helper for this day */}
      {renderDragHelper(dayIndex, day, dragPosition)}
      
      {/* Drop indicator for task drops - render as transparent event preview */}
      {dropHoverPosition && isSameDay(dropHoverPosition.day, day) && (() => {
        const startMinutes = dropHoverPosition.time.getHours() * 60 + dropHoverPosition.time.getMinutes();
        // Get duration from the current drag data (default 60 minutes)
        const durationMinutes = currentDragData?.data?.durationMinutes || 60;
        const taskContent = currentDragData?.data?.taskContent || 'Task';
        const endMinutes = startMinutes + durationMinutes;
        
        // Calculate position adjusting for zoom
        const startHour = isZoomActive ? zoomWindow.startHour : 0;
        const endHour = isZoomActive ? zoomWindow.endHour : 24;
        const totalMinutes = (endHour - startHour) * 60;
        const startOffset = startMinutes - (startHour * 60);
        
        const top = (startOffset / totalMinutes) * (calendarHeight || slotHeight * timeSlots.length);
        const height = (durationMinutes / totalMinutes) * (calendarHeight || slotHeight * timeSlots.length);
        
        const endTime = new Date(dropHoverPosition.time);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);
        
        return (
          <div
            className="absolute left-0 right-0 bg-primary/30 border-2 border-primary border-dashed rounded pointer-events-none z-50 px-2 py-1 overflow-hidden"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 20)}px`,
            }}
          >
            <div className="text-xs font-semibold text-primary truncate">
              {taskContent}
            </div>
            <div className="text-[10px] text-primary/80">
              {format(dropHoverPosition.time, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// -------- Prop Interfaces --------
interface CalendarGridProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly calendars?: { id: string; color: string; name: string; isVisible: boolean }[]; // Add calendars as an optional prop
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date, isAllDay?: boolean) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => void;
  readonly onTaskDrop?: (taskId: string, startTime: Date, durationMinutes: number) => Promise<void>;
}


// -------- CalendarGrid Component --------
export function CalendarGrid({ 
  days, 
  events, 
  calendars, // Added calendars parameter
  openEditDialog, 
  openNewEventDialog,
  onEventUpdate,
  onTaskDrop
}: CalendarGridProps) {
  const dateLocale = useDateLocale();
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const [slotHeight, setSlotHeight] = useState(35); // default slot height
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track if we're currently dragging an event
  const [activeEvent, setActiveEvent] = useState<DraggedEvent | null>(null);
  
  // Visual position during drag (for visual feedback)
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  
  // Current time tracker for showing time indicator line
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Flag to prevent click handlers during drag operations
  const isDraggingRef = useRef(false);
  
  // Event group modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupEvent, setSelectedGroupEvent] = useState<CalendarEvent | null>(null);
  const [isDragHoverModalOpen, setIsDragHoverModalOpen] = useState(false);

  // FlexyDND state for task dropping
  const [dropHoverPosition, setDropHoverPosition] = useState<{ day: Date; time: Date } | null>(null);
  const flexyDND = useFlexyDND();

  // Helper function to calculate time from drop position
  const calculateTimeFromPosition = (day: Date, position: FlexyDragPosition, dayElement: HTMLElement): Date => {
    const rect = dayElement.getBoundingClientRect();
    const relativeY = position.y - rect.top;
    const totalHeight = rect.height;
    
    // Calculate hours and minutes based on zoom window if active
    const startHour = isZoomActive ? zoomWindow.startHour : 0;
    const endHour = isZoomActive ? zoomWindow.endHour : 24;
    const totalHours = endHour - startHour;
    
    // Calculate the time position
    const hoursFraction = (relativeY / totalHeight) * totalHours;
    const totalMinutes = (startHour + hoursFraction) * 60;
    
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    const hours = Math.floor(snappedMinutes / 60);
    const minutes = snappedMinutes % 60;
    
    // Create date with calculated time
    const resultDate = new Date(day);
    resultDate.setHours(hours, minutes, 0, 0);
    
    return resultDate;
  };

  // Zoom state management - initialize from localStorage or default to 100% (no zoom)
  const [isZoomActive, setIsZoomActive] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('calendar-zoom-active');
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });
  const [zoomWindow, setZoomWindow] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('calendar-zoom-window');
      return stored ? JSON.parse(stored) : {
        startHour: 0,
        endHour: 24,
        windowHeight: 300
      };
    }
    return {
      startHour: 0,
      endHour: 24,
      windowHeight: 300
    };
  });
  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
  const [isDraggingZoom, setIsDraggingZoom] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartZoomWindow, setDragStartZoomWindow] = useState({ startHour: 0, endHour: 24 });
  const timelineRef = useRef<HTMLDivElement>(null);

  // Persist zoom state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-zoom-active', JSON.stringify(isZoomActive));
    }
  }, [isZoomActive]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-zoom-window', JSON.stringify(zoomWindow));
    }
  }, [zoomWindow]);

  // Generate time slots based on zoom state with granular intervals
  // Only use zoom if it's not 100% (0-24 hours)
  const isActuallyZoomed = zoomWindow.startHour !== 0 || zoomWindow.endHour !== 24;
  
  const generateGranularTimeSlots = (startHour: number, endHour: number) => {
    const windowSize = endHour - startHour;
    
    // Determine main granularity and preview granularity based on zoom level
    let intervalMinutes = 60; // Default: hourly
    let previewIntervalMinutes = null; // No preview by default
    
    if (windowSize <= 2) {
      intervalMinutes = 5; // 5-minute intervals when zoomed to 2 hours or less
    } else if (windowSize <= 3) {
      intervalMinutes = 15; // 15-minute intervals
      previewIntervalMinutes = 5; // Show 5-minute grid lines without labels
    } else if (windowSize <= 4) {
      intervalMinutes = 15; // 15-minute intervals when zoomed to 4 hours or less
    } else if (windowSize <= 6) {
      intervalMinutes = 30; // 30-minute intervals
      previewIntervalMinutes = 15; // Show 15-minute grid lines without labels
    } else if (windowSize <= 8) {
      intervalMinutes = 30; // 30-minute intervals when zoomed to 8 hours or less
    } else if (windowSize <= 12) {
      intervalMinutes = 60; // Hourly intervals
      previewIntervalMinutes = 30; // Show 30-minute grid lines without labels
    }
    
    const slots = [];
    const totalMinutes = (endHour - startHour) * 60;
    
    // Generate main time slots with labels
    for (let minutes = 0; minutes < totalMinutes; minutes += intervalMinutes) {
      const totalHours = startHour + (minutes / 60);
      const hour = Math.floor(totalHours);
      const minute = Math.round((totalHours - hour) * 60);
      
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      slots.push({
        time: `${formattedHour}:${formattedMinute}`,
        hasLabel: true,
        isMain: true
      });
    }
    
    // Add preview slots (grid lines without labels) if applicable
    if (previewIntervalMinutes) {
      for (let minutes = 0; minutes < totalMinutes; minutes += previewIntervalMinutes) {
        const totalHours = startHour + (minutes / 60);
        const hour = Math.floor(totalHours);
        const minute = Math.round((totalHours - hour) * 60);
        
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        const timeString = `${formattedHour}:${formattedMinute}`;
        
        // Only add if it's not already in the main slots
        if (!slots.some(slot => slot.time === timeString)) {
          slots.push({
            time: timeString,
            hasLabel: false,
            isMain: false
          });
        }
      }
    }
    
    // Sort slots by time
    slots.sort((a, b) => {
      const [aHour, aMin] = a.time.split(':').map(Number);
      const [bHour, bMin] = b.time.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
    
    return slots;
  };
  
  const timeSlots = isZoomActive && isActuallyZoomed
    ? generateGranularTimeSlots(zoomWindow.startHour, zoomWindow.endHour)
    : generateTimeSlots();

  // Update current time every minute
  useEffect(() => {
    // Set current time on first render
    setCurrentTime(new Date());
    
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60000ms = 1 minute
    
    return () => clearInterval(interval);
  }, []);

  // Calculate calendar height based on available container space
  useEffect(() => {
    // Calculate on initial render
    calculateCalendarHeightAndSlotSize();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateCalendarHeightAndSlotSize);
    
    // Clean up event listener
    return () => window.removeEventListener('resize', calculateCalendarHeightAndSlotSize);
  }, [timeSlots.length]);

  // Recalculate when container size changes
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        calculateCalendarHeightAndSlotSize();
      });
      
      resizeObserver.observe(containerRef.current.parentElement || containerRef.current);
      
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Global mouse event listeners for drag operations
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingZoom) {
        const deltaY = e.clientY - dragStartY;
        const timelineHeight = timelineRef.current?.getBoundingClientRect().height || 1;
        const hoursDelta = -(deltaY / timelineHeight) * 24; // Reverse the direction
        
        const windowSize = dragStartZoomWindow.endHour - dragStartZoomWindow.startHour;
        let newStartHour = Math.round(dragStartZoomWindow.startHour + hoursDelta);
        let newEndHour = Math.round(dragStartZoomWindow.endHour + hoursDelta);
        
        // Keep within bounds
        if (newStartHour < 0) {
          newStartHour = 0;
          newEndHour = Math.round(windowSize);
        } else if (newEndHour > 24) {
          newEndHour = 24;
          newStartHour = Math.round(24 - windowSize);
        }
        
        setZoomWindow((prev: { startHour: number; endHour: number }) => ({
          ...prev,
          startHour: newStartHour,
          endHour: newEndHour
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingZoom(false);
    };

    if (isDraggingZoom) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingZoom, dragStartY, dragStartZoomWindow]);

  // Extracted function to calculate calendar height and slot size
  const calculateCalendarHeightAndSlotSize = () => {
    // Get available height from the calendar grid container
    const gridContainer = containerRef.current;
    let availableHeight = 500; // fallback
    
    if (gridContainer) {
      // Get the actual available height by measuring the parent container
      // and subtracting the space used by day headers and all-day events
      const parentElement = gridContainer.parentElement;
      if (parentElement) {
        const parentRect = parentElement.getBoundingClientRect();
        
        // Find the day headers and all-day events sections
        const dayHeadersElement = parentElement.querySelector('.grid.border-b.flex-shrink-0');
        const allDayElement = parentElement.querySelector('.grid.border-b.bg-muted\\/30');
        
        let usedHeight = 0;
        if (dayHeadersElement) {
          usedHeight += dayHeadersElement.getBoundingClientRect().height;
        }
        if (allDayElement) {
          usedHeight += allDayElement.getBoundingClientRect().height;
        }
        
        // Available height is parent height minus the space used by headers
        availableHeight = parentRect.height - usedHeight;
        
      }
    }
    
    // Calculate slot height to use the full available height
    // Distribute the height evenly, using fractional pixels if needed
    const exactSlotHeight = availableHeight / timeSlots.length;
    
    // Ensure minimum slot height for readability
    const minSlotHeight = 25;
    const calculatedSlotHeight = Math.max(minSlotHeight, exactSlotHeight);
    
    // Use the full available height
    const newHeight = availableHeight;
    
    
    setCalendarHeight(newHeight);
    setSlotHeight(calculatedSlotHeight);
  };

  // Zoom window calculation functions
  const calculateZoomWindowPosition = (mouseY: number) => {
    if (!timelineRef.current) return null;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeY = mouseY - rect.top;
    const totalHeight = rect.height;
    
    // Calculate which hour the mouse is over
    // In zoom mode, the overview timeline represents 24 hours
    // In normal mode, the main timeline represents 24 hours
    const hourAtMouse = Math.floor((relativeY / totalHeight) * 24);
    
    // Calculate zoom window bounds
    const windowHours = zoomWindow.endHour - zoomWindow.startHour;
    let startHour = Math.max(0, hourAtMouse - Math.floor(windowHours / 2));
    let endHour = Math.min(24, startHour + windowHours);
    
    // Adjust if we hit the boundaries
    if (endHour === 24) {
      startHour = Math.max(0, 24 - windowHours);
    }
    
    return { startHour, endHour };
  };

  const handleTimelineMouseEnter = () => {
    setIsHoveringTimeline(true);
  };

  const handleTimelineMouseLeave = () => {
    setIsHoveringTimeline(false);
    // Don't clear zoom when mouse leaves - zoom should persist
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (!isHoveringTimeline || !isZoomActive || !isActuallyZoomed) return;
    
    e.preventDefault();
    setIsDraggingZoom(true);
    setDragStartY(e.clientY);
    setDragStartZoomWindow({ startHour: zoomWindow.startHour, endHour: zoomWindow.endHour });
  };


  const handleCalendarWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 1 : -1; // Positive for zoom out, negative for zoom in
    const currentWindowSize = zoomWindow.endHour - zoomWindow.startHour;
    const newWindowSize = Math.max(2, Math.min(24, currentWindowSize + delta * 2));
    
    // Activate zoom on first wheel interaction
    if (!isZoomActive) {
      setIsZoomActive(true);
    }
    
    // Calculate which hour the mouse is over based on the calendar grid
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    const relativeY = e.clientY - containerRect.top;
    const totalHeight = containerRect.height;
    
    // Calculate which hour the mouse is over (relative to current zoom window or full day)
    let hourAtMouse;
    if (isZoomActive && isActuallyZoomed) {
      // If already zoomed, calculate relative to current zoom window
      hourAtMouse = zoomWindow.startHour + (relativeY / totalHeight) * (zoomWindow.endHour - zoomWindow.startHour);
    } else {
      // If not zoomed, calculate relative to full day
      hourAtMouse = (relativeY / totalHeight) * 24;
    }
    
    // Center the new zoom window around the mouse position
    let startHour = Math.max(0, hourAtMouse - newWindowSize / 2);
    let endHour = Math.min(24, startHour + newWindowSize);
    
    // Adjust if we hit boundaries
    if (endHour === 24) {
      startHour = Math.max(0, 24 - newWindowSize);
    }
    
    setZoomWindow((prev: { startHour: number; endHour: number }) => ({
      ...prev,
      startHour,
      endHour
    }));
  };

  // Function to find which day column the mouse is over
  const findDayColumnAtPosition = (clientX: number): Element | null => {
    if (!containerRef.current || !activeEvent) return null;
    
    const dayColumns = containerRef.current.querySelectorAll('.day-column');
    if (!dayColumns.length) return null;

    for (const column of dayColumns) {
      const rect = column.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return column;
      }
    }
    return null;
  };

  // Function to get the date from the target column
  const getDateFromColumn = (column: Element): Date | null => {
    const dateString = column.getAttribute('data-date');
    if (!dateString) return null;
    return new Date(dateString);
  };

  // Helper function to find if mouse is hovering over a group event
  const findGroupEventAtPosition = (mouseX: number, mouseY: number): CalendarEvent | null => {
    if (!containerRef.current) return null;
    
    // Use elementFromPoint which respects pointer-events: none
    const element = document.elementFromPoint(mouseX, mouseY);
    if (!element) return null;
    
    // Walk up the DOM tree to find an element with data-event-id
    let currentElement: Element | null = element;
    while (currentElement && currentElement !== containerRef.current) {
      const eventId = currentElement.getAttribute('data-event-id');
      if (eventId) {
        // Find the event in our events array
        const event = events.find(e => e.id === eventId);
        
        // Return only if it's a group event and not the currently dragged event
        if (event && event.is_group_event && event.id !== activeEvent?.event.id) {
          return event;
        }
        // If we found an event but it's not a group, break
        break;
      }
      currentElement = currentElement.parentElement;
    }
    
    return null;
  };

  // Add global mouse handlers for drag operations
  useEffect(() => {
    // Only attach if we have an event and the update handler
    if (!activeEvent || !onEventUpdate) return;    

    const handleMouseMove = (e: MouseEvent) => {
      // We're in a drag operation if the mouse moves significantly
      const dx = Math.abs(e.clientX - activeEvent.initialPosition.x);
      const dy = Math.abs(e.clientY - activeEvent.initialPosition.y);
      
      if (dx > 5 || dy > 5) {
        isDraggingRef.current = true;
      }
      
      // Update the visual position of the event being dragged
      if (isDraggingRef.current && containerRef.current) {
        updateDragPosition(e);
      }
    };
    
    // Handle escape key to exit group modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragHoverModalOpen) {
        setIsDragHoverModalOpen(false);
        setSelectedGroupEvent(null);
      }
    };
    
    // Extract position calculation logic to reduce complexity
    const updateDragPosition = (e: MouseEvent) => {
      
      // Find which day column we're over
      const columnMouseIsCurrentlyOver = findDayColumnAtPosition(e.clientX);
      if (!columnMouseIsCurrentlyOver) return;

      const targetDay = getDateFromColumn(columnMouseIsCurrentlyOver);
      if (!targetDay) return;

      // Calculate new position
      const columnMouseOverRect = columnMouseIsCurrentlyOver.getBoundingClientRect();
      
      // Calculate zoom parameters for drag positioning
      const windowSize = zoomWindow.endHour - zoomWindow.startHour;
      let smallestInterval = 60;
      if (windowSize <= 2) {
        smallestInterval = 5;
      } else if (windowSize <= 3) {
        smallestInterval = 5; // Preview slots are 5-minute
      } else if (windowSize <= 4) {
        smallestInterval = 15;
      } else if (windowSize <= 6) {
        smallestInterval = 15; // Preview slots are 15-minute
      } else if (windowSize <= 8) {
        smallestInterval = 30;
      } else if (windowSize <= 12) {
        smallestInterval = 30; // Preview slots are 30-minute
      }

      const zoomStartHour = isZoomActive && isActuallyZoomed ? zoomWindow.startHour : 0;
      const zoomIntervalMinutes = isZoomActive && isActuallyZoomed ? smallestInterval : 60;

      // Calculate the new drag position using the utility function
      const result = calculateDraggingEventDateTime(
        e.clientY,
        columnMouseOverRect, 
        activeEvent, 
        slotHeight,
        targetDay,
        zoomStartHour,
        zoomIntervalMinutes
      );
      
      // Check if hovering over a group event
      const groupEvent = findGroupEventAtPosition(e.clientX, e.clientY);
      
      // Prevent nesting: Don't allow a group event to be dropped into another group
      if (groupEvent && !activeEvent.event.is_group_event) {
        // Open modal to show group contents during drag
        if (groupEvent.id !== selectedGroupEvent?.id || !isDragHoverModalOpen) {
          console.log('Hovering over group event:', groupEvent.id, groupEvent.title);
          setSelectedGroupEvent(groupEvent);
          setIsDragHoverModalOpen(true);
        }
      } else {
        // Not hovering over a valid group, close modal
        if (isDragHoverModalOpen) {
          console.log('Left group event area');
          setIsDragHoverModalOpen(false);
          setSelectedGroupEvent(null);
        }
      }
      
      // Update the visual position state
      setDragPosition(result);

    };


    const handleMouseUp = (e: MouseEvent) => {
      const wasDragging = isDraggingRef.current;
      
      // Only process the drag if we actually moved (isDragging)
      if (wasDragging && containerRef.current) {
        processDragEnd(e);
        
        // Reset drag state after a short delay to prevent unwanted clicks
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      } else {
        // If we didn't drag, reset immediately so clicks work
        isDraggingRef.current = false;
      }
      
      cleanupDrag();
    };
    
    // Extract the drag end processing logic
    const processDragEnd = (e: MouseEvent) => {
      // Find which day column we're over
      const columnMouseIsCurrentlyOver = findDayColumnAtPosition(e.clientX);
      if (!columnMouseIsCurrentlyOver) return;

      const targetDay = getDateFromColumn(columnMouseIsCurrentlyOver);
      if (!targetDay) return;

      // Calculate new position
      const columnMouseOverRect = columnMouseIsCurrentlyOver.getBoundingClientRect();
      
      // Calculate zoom parameters for drag positioning
      const windowSize = zoomWindow.endHour - zoomWindow.startHour;
      let smallestInterval = 60;
      if (windowSize <= 2) {
        smallestInterval = 5;
      } else if (windowSize <= 3) {
        smallestInterval = 5; // Preview slots are 5-minute
      } else if (windowSize <= 4) {
        smallestInterval = 15;
      } else if (windowSize <= 6) {
        smallestInterval = 15; // Preview slots are 15-minute
      } else if (windowSize <= 8) {
        smallestInterval = 30;
      } else if (windowSize <= 12) {
        smallestInterval = 30; // Preview slots are 30-minute
      }

      const zoomStartHour = isZoomActive && isActuallyZoomed ? zoomWindow.startHour : 0;
      const zoomIntervalMinutes = isZoomActive && isActuallyZoomed ? smallestInterval : 60;

      // Calculate the new drag position using the utility function
      const result = calculateDraggingEventDateTime(
        e.clientY,
        columnMouseOverRect, 
        activeEvent, 
        slotHeight,
        targetDay,
        zoomStartHour,
        zoomIntervalMinutes
      );
      
      // Check if dropped on a group event
      // If drag hover modal is open, use the selected group event (modal covers the actual group)
      const groupEvent = isDragHoverModalOpen && selectedGroupEvent 
        ? selectedGroupEvent 
        : findGroupEventAtPosition(e.clientX, e.clientY);
      
      // If dropping into a recurring group instance, extract the base group ID
      let parentGroupEventId = activeEvent.event.parent_group_event_id;
      if (groupEvent && !activeEvent.event.is_group_event) {
        // Extract base ID if this is a recurring instance (e.g., groupId-recurrence-2024-12-10 -> groupId)
        parentGroupEventId = groupEvent.id.includes('-recurrence-')
          ? groupEvent.id.split('-recurrence-')[0]
          : groupEvent.id;
      }
      
      // Create updated event - explicitly preserve is_group_event
      const updatedEvent: CalendarEvent = {
        ...activeEvent.event,
        start_time: result.startTime.toISOString(),
        end_time: result.endTime.toISOString(),
        updated_at: new Date().toISOString(),
        // Explicitly preserve is_group_event flag
        is_group_event: activeEvent.event.is_group_event,
        // Set parent group if dropped on a group (and not a group itself)
        parent_group_event_id: parentGroupEventId
      };
      
      // Update the event
      onEventUpdate(updatedEvent);
    };

    // Clean up function
    const cleanupDrag = () => {
      setActiveEvent(null);
      setDragPosition(null);
      setIsDragHoverModalOpen(false);
      // Don't clear selectedGroupEvent here - it might be used for the regular modal
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // Clean up on unmount or when activeEvent changes
    return cleanupDrag;
  }, [activeEvent, days, onEventUpdate, slotHeight]);

  // Handle the mouse down event on an event div
  const handleEventMouseDown = (
    e: React.MouseEvent, 
    event: CalendarEvent, 
    dayIndex: number,
    mode: DragMode = DragMode.Move // Default to move if not specified
  ) => {
    // Only enable drag if we can update
    if (!onEventUpdate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get the position of the click within the event element
    const eventRect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - eventRect.top;
    
    // Set the active event with the offset position
    setActiveEvent({
      event,
      initialPosition: { x: e.clientX, y: e.clientY },
      offsetY,
      mode // Use the specified drag mode
    });
  };

  // Handle click on a day cell - only if we're not dragging
  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Don't open dialog if we're in a drag operation
    if (isDraggingRef.current || activeEvent) return;
    
    // Calculate the time based on mouse click position
    if (containerRef.current) {
      const dayColumnElement = e.currentTarget as HTMLElement;
      const rect = dayColumnElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Calculate minutes from top position
      const totalMinutes = (relativeY / slotHeight) * 60;
      
      // Round minutes to nearest 15-minute interval for better usability
      const snappedMinutes = Math.round(totalMinutes / 15) * 15;
      
      // Calculate hours and minutes components
      const hours = Math.floor(snappedMinutes / 60);
      const minutes = snappedMinutes % 60;
      
      // Create new date with calculated time
      const clickedDateTime = new Date(day);
      clickedDateTime.setHours(hours, minutes, 0, 0);
      
      // Open dialog with the clicked time
      openNewEventDialog(clickedDateTime, false);
    } else {
      // Fallback to just the day if container ref isn't available
      openNewEventDialog(day, false);
    }
  };

  // Handle click on all-day section - creates an all-day event
  const handleAllDayClick = (day: Date, e: React.MouseEvent) => {
    // Don't open dialog if we're in a drag operation
    if (isDraggingRef.current || activeEvent) return;
    
    // Check if click was on an existing event (event propagation should handle this, but double-check)
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-id]')) {
      return; // Don't create new event if clicking on existing one
    }
    
    // Create a new all-day event for this day
    // Set time to start of day for all-day events
    const allDayDate = new Date(day);
    allDayDate.setHours(0, 0, 0, 0);
    
    openNewEventDialog(allDayDate, true);
  };

  // Handle click on an event - only if we're not dragging
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    
    // Don't open the edit dialog if we're in a drag operation
    if (isDraggingRef.current) return;
    
    // If this is a group event, open the group modal instead
    if (event.is_group_event) {
      setSelectedGroupEvent(event);
      setIsGroupModalOpen(true);
      return;
    }
    
    // Check if this is a recurrence instance
    const isRecurrenceInstance = 'isRecurrenceInstance' in event && event.isRecurrenceInstance;
    
    if (isRecurrenceInstance) {
      // For recurrence instances, find the master event and pass its details
      // along with the specific instance's start time as clickedOccurrenceDate
      const masterEventId = event.id.split('-recurrence-')[0];
      const masterEvent = events.find(e => e.id === masterEventId);
      
      if (masterEvent) {
        openEditDialog({
          ...masterEvent,
          clickedOccurrenceDate: event.start_time, // start_time of the clicked instance
          isRecurrenceInstance: true // Keep this to inform the dialog it's an instance context
        } as CalendarEvent);
      } else {
        // Fallback if master not found (should ideally not happen)
        // Open the instance itself, marking its own start time as the clicked date
        openEditDialog({
          ...event, 
          clickedOccurrenceDate: event.start_time,
          isRecurrenceInstance: true
        } as CalendarEvent);
      }
    } else {
      // For regular events or when clicking the master event directly from some other UI (not an instance on grid)
      openEditDialog(event); // clickedOccurrenceDate will be undefined, handlers will use master.startTime
    }
  };

  // Debug events received by CalendarGrid
  useEffect(() => {
  }, [events]);

  // Every time events or calendars change, ensure calendar colors are properly attached
  useEffect(() => {
    // Every time events or calendars change, ensure calendar colors are properly attached
    if (events.length > 0 && calendars && calendars.length > 0) {
      // Create a local copy of events with calendar colors attached
      // Instead of trying to update the events prop directly
      const updatedEvents = events.map(event => {
        // If the event already has a calendar with color, don't change it
        if ((event as any).calendar?.color) return event;
        
        // Find the matching calendar and ensure it's attached
        const calendar = calendars.find(cal => cal.id === event.calendar_id);
        if (calendar) {
          return {
            ...event,
            calendar: {
              ...calendar
            }
          };
        }
        return event;
      });
      
      // We don't need to update state since we're using the local variable
      // inside this component for rendering
    }
  }, [events, calendars]);

  // Calculate event rendering with zoom support
  const calculateZoomedEventRendering = (
    event: CalendarEvent,
    day: Date,
    slotHeight: number,
    zIndex: number,
    opacity: number,
    columnIndex: number = 0,
    totalColumns: number = 1
  ) => {
    if (!isZoomActive || !isActuallyZoomed) {
      return calculateEventRendering(event, day, slotHeight, zIndex, opacity, columnIndex, totalColumns);
    }

    // For zoom mode, adjust calculations
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    
    const eventStart = isSameDay(startTime, day) 
      ? startTime 
      : new Date(day.getFullYear(), day.getMonth(), day.getDate(), zoomWindow.startHour, 0, 0);
    
    const eventEnd = isSameDay(endTime, day) 
      ? endTime 
      : new Date(day.getFullYear(), day.getMonth(), day.getDate(), zoomWindow.endHour, 0, 0);
    
    // Calculate position relative to zoom window start
    const zoomStartTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), zoomWindow.startHour, 0, 0);
    const minutesFromZoomStart = differenceInMinutes(eventStart, zoomStartTime);
    
    // Find the smallest interval in the current time slots to calculate position accurately
    const windowSize = zoomWindow.endHour - zoomWindow.startHour;
    let smallestInterval = 60;
    if (windowSize <= 2) {
      smallestInterval = 5;
    } else if (windowSize <= 3) {
      smallestInterval = 5; // Preview slots are 5-minute
    } else if (windowSize <= 4) {
      smallestInterval = 15;
    } else if (windowSize <= 6) {
      smallestInterval = 15; // Preview slots are 15-minute
    } else if (windowSize <= 8) {
      smallestInterval = 30;
    } else if (windowSize <= 12) {
      smallestInterval = 30; // Preview slots are 30-minute
    }
    
    const topPosition = (minutesFromZoomStart / smallestInterval) * slotHeight;
    
    // Calculate height based on the smallest interval
    const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
    const height = (durationInMinutes / smallestInterval) * slotHeight;
    
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

  // Render a single event with explicit layout parameters (for advanced layout algorithm)
  const renderSingleEventWithLayout = (
    event: CalendarEvent, 
    day: Date, 
    dayIndex: number, 
    zIndex: number = 10, 
    opacity: number = 100,
    leftPercent: number,
    widthPercent: number,
    totalColumns: number = 1
  ) => {
    // Calculate base event rendering without width/left (we'll override those)
    const { eventStyles: baseStyles, startTime, endTime } = calculateZoomedEventRendering(
      event, 
      day, 
      slotHeight, 
      zIndex, 
      opacity, 
      0, 
      1
    );
    
    // Override width and left with our calculated layout
    const eventStyles = {
      ...baseStyles,
      width: `calc(${widthPercent}% - 4px)`,
      left: `${leftPercent}%`
    };
    
    return renderEventElement(event, eventStyles, startTime, endTime, day, dayIndex, zIndex, totalColumns);
  };

  // Render event element - shared JSX rendering logic
  const { highlightedEventId } = useCalendar();

  const renderEventElement = (
    event: CalendarEvent,
    eventStyles: any,
    startTime: Date,
    endTime: Date,
    day: Date,
    dayIndex: number,
    zIndex: number,
    totalColumns: number
  ) => {
    // Check if this is a recurring event or a recurring instance
    const recurrencePattern = getRecurrencePattern(event);
    const isRecurring = recurrencePattern?.frequency !== undefined && 
                        recurrencePattern.frequency !== RecurrenceFrequency.None;
    
    const isRecurrenceInstance = event.id.includes('-recurrence-');

    // Determine calendar color with improved fallback mechanism
    let calendarColor = null;
    
    // First try to get color from the calendar object directly
    if ((event as any).calendar && (event as any).calendar.color) {
      calendarColor = (event as any).calendar.color;
    }
    
    // If not found, look up the calendar from the calendars prop
    if (!calendarColor && calendars) {
      const calendar = calendars.find(cal => cal.id === event.calendar_id);
      if (calendar && calendar.color) {
        calendarColor = calendar.color;
      }
    }
    
    // Set default colors (same for all event types)
    const defaultColor = 'rgb(99, 102, 241)'; // indigo-500 for all events
    const defaultBorderColor = 'rgb(79, 70, 229)'; // indigo-600 for all events
    
    // Use calendar color or fall back to defaults
    const bgColor = calendarColor || defaultColor;
    const borderColor = calendarColor || defaultBorderColor;
    
    const isTaskReservationSpace = Boolean(event.is_task_reservation_space);
    
    // For group events, use transparent background with solid border
    const groupEventStyles = event.is_group_event ? {
      backgroundColor: isTaskReservationSpace
        ? `${bgColor}18`
        : `${bgColor}20`,
      backgroundImage: isTaskReservationSpace
        ? `repeating-linear-gradient(
            135deg,
            ${bgColor}10 0px,
            ${bgColor}10 10px,
            transparent 10px,
            transparent 20px
          )`
        : undefined,
      borderWidth: '2px',
      borderStyle: isTaskReservationSpace ? 'dashed' : 'solid',
      borderColor: borderColor,
      boxShadow: isTaskReservationSpace
        ? `inset 0 0 0 1px ${bgColor}30`
        : undefined,
    } : {};
    
    // Get child events if this is a group event
    // For recurring group event instances, extract the base ID
    const baseGroupEventId = event.id.includes('-recurrence-') 
      ? event.id.split('-recurrence-')[0] 
      : event.id;
    
    const isRecurringInstance = event.id.includes('-recurrence-');
    
    let childEvents: CalendarEvent[] = [];
    if (event.is_group_event) {
      // Get base child events (those stored in DB with parent_group_event_id)
      const baseChildEvents = events.filter(e => e.parent_group_event_id === baseGroupEventId);
      
      if (isRecurringInstance) {
        // For recurring group instances, create virtual child events with adjusted times
        const originalGroupStart = new Date(baseChildEvents[0]?.start_time).getTime() || 0;
        const recurringGroupStart = new Date(event.start_time);
        
        // Find the original (non-recurring) group event to calculate time offsets
        const originalGroupEvent = events.find(e => e.id === baseGroupEventId);
        if (originalGroupEvent) {
          const originalGroupStartTime = new Date(originalGroupEvent.start_time).getTime();
          const recurringGroupStartTime = recurringGroupStart.getTime();
          const timeOffset = recurringGroupStartTime - originalGroupStartTime;
          
          // Create virtual child events with adjusted times
          childEvents = baseChildEvents.map(child => ({
            ...child,
            id: `${child.id}-recurrence-${format(recurringGroupStart, 'yyyy-MM-dd')}`,
            start_time: new Date(new Date(child.start_time).getTime() + timeOffset).toISOString(),
            end_time: new Date(new Date(child.end_time).getTime() + timeOffset).toISOString()
          })).filter(e => isSameDay(new Date(e.start_time), day));
        }
      } else {
        // For non-recurring group events, just filter by day
        childEvents = baseChildEvents.filter(e => isSameDay(new Date(e.start_time), day));
      }
    }
    
    // Calculate group time range for positioning child events
    const groupStart = new Date(event.start_time);
    const groupEnd = new Date(event.end_time);
    const groupDuration = differenceInMinutes(groupEnd, groupStart);

    return (
      <div
        key={event.id}
        data-event-id={event.id}
        className={`absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white 
           shadow-sm group transition-all duration-200
           ${onEventUpdate ? 'cursor-move' : 'cursor-pointer'}
           ${event.is_group_event ? 'backdrop-blur-sm' : ''}
           ${highlightedEventId === event.id ? 'event-highlight-flash' : ''}`}
        style={{
          ...eventStyles,
          backgroundColor: bgColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: borderColor,
          ...groupEventStyles,
        }}
        onClick={(e) => handleEventClick(e, event)}
        onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.Move)}
        role='button'
      >
        {/* Top resize handle - only visible on hover */}
        {onEventUpdate && (
          <div 
            className="absolute top-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/30"
            onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeTop)}
            role='button'
          />
        )}
        
        {event.is_group_event ? (
          <div className="relative z-10 -mx-2 -mt-2 px-2 pt-2 pb-1 bg-white/80 dark:bg-gray-900/80 group-hover:bg-white/10 dark:group-hover:bg-gray-900/10 transition-colors">
            <div className="font-medium truncate flex items-center gap-1 text-gray-900 dark:text-gray-100 group-hover:opacity-10 transition-opacity">
              <span className="inline-flex items-center flex-shrink-0" style={{ color: borderColor }}>
                {isTaskReservationSpace ? (
                  <CalendarClock className="h-3.5 w-3.5" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                )}
              </span>
              <span className="truncate">{event.title}</span>
            </div>
            <div className="text-xs truncate text-gray-700 dark:text-gray-300 group-hover:opacity-10 transition-opacity">
              {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
            </div>
          </div>
        ) : (
          <>
            <div className="font-medium truncate flex items-center gap-1">
              {(isRecurring || isRecurrenceInstance) ? (
                <span className="inline-flex items-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
                    <path d="M12 7v5l2.5 2.5"></path>
                  </svg>
                </span>
              ) : null}
              <span className="truncate">{event.title}</span>
            </div>
            <div className="text-xs truncate">
              {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
            </div>
          </>
        )}
        {event.location && (
          <div className={`text-xs truncate opacity-90 ${event.is_group_event ? 'relative z-10 text-gray-700 dark:text-gray-300' : ''}`}>
            📍 {event.location}
          </div>
        )}
        
        {/* Render child events inside the group */}
        {event.is_group_event && childEvents.length > 0 && !(activeEvent && isDraggingRef.current && activeEvent.event.id === event.id) && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {childEvents.map(childEvent => {
              const childStart = new Date(childEvent.start_time);
              const childEnd = new Date(childEvent.end_time);
              const childDuration = differenceInMinutes(childEnd, childStart);
              
              // Calculate position relative to group
              const minutesFromGroupStart = differenceInMinutes(childStart, groupStart);
              const topPercent = Math.max(0, (minutesFromGroupStart / groupDuration) * 100);
              const heightPercent = Math.min(100 - topPercent, (childDuration / groupDuration) * 100);
              
              // Get child event color
              const childCalendar = calendars?.find(cal => cal.id === childEvent.calendar_id);
              const childColor = childCalendar?.color || defaultColor;
              
              return (
                <div
                  key={childEvent.id}
                  className="absolute left-1 right-1 rounded-sm px-1 text-xs overflow-hidden shadow-sm"
                  style={{
                    top: `${topPercent}%`,
                    height: `${heightPercent}%`,
                    minHeight: '16px',
                    backgroundColor: childColor,
                    color: 'white',
                  }}
                  title={`${childEvent.title} (${format(childStart, 'HH:mm')} - ${format(childEnd, 'HH:mm')})`}
                >
                  <div className="font-medium truncate text-[10px]">
                    {childEvent.title}
                  </div>
                  {heightPercent > 15 && (
                    <div className="truncate text-[9px] opacity-80">
                      {format(childStart, 'HH:mm')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Bottom resize handle - only visible on hover */}
        {onEventUpdate && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/30"
            onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeBottom)}
            role='button'
          />
        )}
      </div>
    );
  };

  // Render a single event
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number, zIndex: number = 10, opacity: number = 100, columnIndex: number = 0, totalColumns: number = 1) => {
    // Use the zoom-aware rendering function
    const { eventStyles, startTime, endTime } = calculateZoomedEventRendering(event, day, slotHeight, zIndex, opacity, columnIndex, totalColumns);
    
    return renderEventElement(event, eventStyles, startTime, endTime, day, dayIndex, zIndex, totalColumns);
  };

  // Render events in the calendar grid
  // Filter events based on zoom window
  const filterEventsForZoom = (dayEvents: CalendarEvent[], day: Date): CalendarEvent[] => {
    if (!isZoomActive || !isActuallyZoomed) return dayEvents;
    
    return dayEvents.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      
      // Get event hours
      const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
      const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
      
      // Check if event overlaps with zoom window
      return eventStartHour < zoomWindow.endHour && eventEndHour > zoomWindow.startHour;
    });
  };

  const renderEvents = (day: Date, dayIndex: number) => {
    // Only render timed events in the main grid
    // Exclude child events - they will be rendered inside their parent groups
    let dayEvents = events.filter(event => 
      (isSameDay(new Date(event.start_time), day) || isSameDay(new Date(event.end_time), day)) && 
      !event.all_day &&
      !event.parent_group_event_id // Exclude child events
    );

    // Filter events based on zoom window
    dayEvents = filterEventsForZoom(dayEvents, day);
    
    // Don't render the original event if it's being dragged
    // Only hide the event when actually dragging, not just on mousedown
    if (activeEvent && isDraggingRef.current) {
      dayEvents = dayEvents.filter(event => event.id !== activeEvent.event.id);
    }
    
    if (!dayEvents.length) return [];

    // Group overlapping events
    const eventGroups = groupOverlappingEvents(dayEvents);
    
    const renderedEvents = eventGroups.flatMap(group => {
      // For non-overlapping events (group of 1), render normally
      if (group.length === 1) {
        return renderSingleEvent(group[0], day, dayIndex);
      }
      
      // For overlapping events, use the new layout algorithm
      const layouts = calculateEventLayout(group);
      return layouts.map(layout => {
        const columnWidth = 100 / layout.totalColumns;
        const width = columnWidth * layout.columnSpan;
        const left = columnWidth * layout.column;
        
        return renderSingleEventWithLayout(
          layout.event, 
          day, 
          dayIndex, 
          10, 
          100, 
          left, 
          width,
          layout.totalColumns
        );
      });
    });
    
    return renderedEvents;
  };

  // Render all-day events for a specific day
  const renderAllDayEvents = (day: Date) => {
    const allDayEvents = events.filter(event => {
      if (!event.all_day) return false;
      
      // Check if this day falls within the event's date range
      const eventStart = new Date(event.start_time);
      eventStart.setHours(0, 0, 0, 0);
      const eventEnd = new Date(event.end_time);
      eventEnd.setHours(23, 59, 59, 999);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      return dayStart <= eventEnd && dayEnd >= eventStart;
    });


    if (!allDayEvents.length) return null;

    return allDayEvents.map(event => {
      const calendar = calendars?.find(cal => cal.id === event.calendar_id);
      const eventColor = calendar?.color || '#3B82F6';
      
      // Check if this is a recurring event or recurrence instance
      const recurrencePattern = getRecurrencePattern(event);
      const isRecurring = !!recurrencePattern;
      const isRecurrenceInstance = event.id.includes('-recurrence-');
      
      return (
        <div
          key={event.id}
          className="text-xs px-2 py-1 mb-1 rounded cursor-pointer hover:opacity-80 transition-opacity truncate"
          style={{ 
            backgroundColor: eventColor,
            color: 'white'
          }}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the all-day section click
            openEditDialog(event);
          }}
          data-event-id={event.id}
        >
          <div className="font-medium truncate flex items-center gap-1">
            {(isRecurring || isRecurrenceInstance) ? (
              <span className="inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
                  <path d="M12 7v5l2.5 2.5"></path>
                </svg>
              </span>
            ) : null}
            {event.title}
          </div>
          {event.location && (
            <div className="text-xs opacity-90 truncate">
              📍 {event.location}
            </div>
          )}
        </div>
      );
    });
  };

  // Calculate the position for the current time indicator
  const calculateCurrentTimePosition = (day: Date): number | null => {
    // Only show for current day
    if (!isSameDay(currentTime, day)) return null;
    
    if (isZoomActive && isActuallyZoomed) {
      // In zoom mode, calculate position relative to zoom window
      const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
      
      // Only show if current time is within zoom window
      if (currentHour < zoomWindow.startHour || currentHour >= zoomWindow.endHour) {
        return null;
      }
      
      // Calculate position relative to zoom window start with granular intervals
      const windowSize = zoomWindow.endHour - zoomWindow.startHour;
      let smallestInterval = 60;
      if (windowSize <= 2) {
        smallestInterval = 5;
      } else if (windowSize <= 3) {
        smallestInterval = 5; // Preview slots are 5-minute
      } else if (windowSize <= 4) {
        smallestInterval = 15;
      } else if (windowSize <= 6) {
        smallestInterval = 15; // Preview slots are 15-minute
      } else if (windowSize <= 8) {
        smallestInterval = 30;
      } else if (windowSize <= 12) {
        smallestInterval = 30; // Preview slots are 30-minute
      }
      
      const minutesFromZoomStart = (currentHour - zoomWindow.startHour) * 60;
      return (minutesFromZoomStart / smallestInterval) * slotHeight;
    } else {
      // Normal mode - calculate minutes since start of day (midnight)
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      
      const minutesSinceMidnight = differenceInMinutes(currentTime, dayStart);
      
      // Convert to position
      return (minutesSinceMidnight / 60) * slotHeight;
    }
  };

  // Render current time indicator for a day
  const renderCurrentTimeLine = (day: Date): React.ReactNode => {
    const position = calculateCurrentTimePosition(day);
    
    // Don't render if not current day
    if (position === null) return null;
    
    return (
      <div 
        className="absolute w-full bg-purple-900 z-30 pointer-events-none h-[2px] -translate-y-1/2"
        style={{ 
          top: `${position}px`,
        }}
      >
        {/* Time label */}
        <div 
          className="absolute bg-purple-900 text-white text-xs px-1 py-[1px] top-[1px] rounded-full w-2 h-2 -translate-y-1/2 -translate-x-full"
        >
        </div>

      </div>
    );
  };

  // calculates if two date intervals are overlapping
  const areDatesOverlapping = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && start2 < end1;
  };

  // gets the end of the day
  const getEndOfDay = (day: Date): Date => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    return endOfDay;
  };


  const renderDragHelper = (dayIndex: number, day: Date, dragPosition: DragPosition | null): React.ReactNode => {
    // Only render the drag helper for the day where dragging is active
    if (!activeEvent || !dragPosition) {
      return null;
    }

    // Only render drag helper if this day overlaps with the drag position date range   
    if (!areDatesOverlapping(
      dragPosition.startTime,
      dragPosition.endTime,
      day,
      getEndOfDay(day)
    )) {
      return null;
    }
    
    // Create a temporary event with the dragged position data
    const draggedEvent: CalendarEvent = {
      ...activeEvent.event,
      start_time: dragPosition.startTime.toISOString(),
      end_time: dragPosition.endTime.toISOString()
    };
    
    // If this is a group event, also render child events in the preview
    const childEventPreviews: React.ReactElement[] = [];
    if (activeEvent.event.is_group_event) {
      // Calculate time offset for child events
      const originalStartTime = new Date(activeEvent.event.start_time).getTime();
      const newStartTime = dragPosition.startTime.getTime();
      const timeOffset = newStartTime - originalStartTime;
      
      // Find and render child events with the same offset
      const childEvents = events.filter(e => e.parent_group_event_id === activeEvent.event.id);
      childEvents.forEach((childEvent) => {
        const childStartTime = new Date(childEvent.start_time);
        const childEndTime = new Date(childEvent.end_time);
        
        const newChildStartTime = new Date(childStartTime.getTime() + timeOffset);
        const newChildEndTime = new Date(childEndTime.getTime() + timeOffset);
        
        // Only render if the child event overlaps with this day
        if (areDatesOverlapping(
          newChildStartTime,
          newChildEndTime,
          day,
          getEndOfDay(day)
        )) {
          const draggedChildEvent: CalendarEvent = {
            ...childEvent,
            start_time: newChildStartTime.toISOString(),
            end_time: newChildEndTime.toISOString()
          };
          
          childEventPreviews.push(
            <div key={`drag-child-${childEvent.id}`} style={{ pointerEvents: 'none', position: 'relative' }}>
              {renderSingleEvent(draggedChildEvent, day, dayIndex, 99998, 80)}
            </div>
          );
        }
      });
    }
    
    // Use a wrapper div to apply the opacity and prevent pointer events
    // Use z-index higher than modal overlay (Dialog uses z-50, we use 99999 to be above everything)
    return (
      <div key={`drag-container-${activeEvent.event.id}`} style={{ pointerEvents: 'none', position: 'relative', zIndex: 99999 }}>
        {/* Event preview with reduced opacity (ghost event) */}
        {renderSingleEvent(draggedEvent, day, dayIndex, 99999, 50)}
        {childEventPreviews}
      </div>
    );
  }

  return (
    <div className="border rounded-lg shadow-sm bg-card h-full flex flex-col overflow-hidden">
      {/* Calendar header with days of the week */}
      <div className="grid grid-cols-[60px_1fr] border-b flex-shrink-0">
        {/* Empty cell in the top-left corner for alignment */}
        <div className="border-r"></div>
        
        {/* Days of the week */}
        <div className="grid grid-cols-7">
          {days.map(day => (
            <div 
              key={day.toString()} 
              className="px-2 py-3 text-center border-r last:border-r-0 font-medium flex gap-2 items-center justify-center"
            >
              <div>{format(day, "EEE", { locale: dateLocale })}</div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                {format(day, "d", { locale: dateLocale })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All-day events section */}
      <div className="grid grid-cols-[60px_1fr] border-b bg-muted/30 flex-shrink-0">
        {/* Label for all-day section */}
        <div className="border-r px-2 py-2 text-xs text-muted-foreground text-right">
          All Day
        </div>
        
        {/* All-day events for each day */}
        <div className="grid grid-cols-7">
          {days.map(day => (
            <div 
              key={`allday-${day.toString()}`}
              className="px-2 py-2 border-r last:border-r-0 min-h-[40px] cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={(e) => handleAllDayClick(day, e)}
            >
              {renderAllDayEvents(day)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Calendar grid with time slots - fits available space */}
      <div 
        ref={containerRef}
        className="grid grid-cols-[60px_1fr] overflow-hidden relative"
        style={{ 
          height: calendarHeight ? `${calendarHeight}px` : '100%',
          minHeight: calendarHeight ? `${calendarHeight}px` : '100%',
          maxHeight: calendarHeight ? `${calendarHeight}px` : '100%',
          flex: 'none'
        }}
        onWheel={handleCalendarWheel}
      >
        {/* Single Timeline - Scales based on zoom */}
        <div 
          ref={timelineRef}
          className={`border-r relative ${isDraggingZoom ? 'cursor-grabbing' : isZoomActive && isActuallyZoomed ? 'cursor-grab' : ''}`}
          onMouseEnter={handleTimelineMouseEnter}
          onMouseLeave={handleTimelineMouseLeave}
          onMouseDown={handleTimelineMouseDown}
        >
          {timeSlots.map((slot, i) => {
            // Handle both old string format and new object format
            const timeString = typeof slot === 'string' ? slot : slot.time;
            const hasLabel = typeof slot === 'string' ? true : slot.hasLabel;
            const isMain = typeof slot === 'string' ? true : slot.isMain;
            
            const isHourMark = timeString.endsWith(':00');
            const isHalfHour = timeString.endsWith(':30');
            const isQuarterHour = timeString.endsWith(':15') || timeString.endsWith(':45');
            const isFiveMinute = !isHourMark && !isHalfHour && !isQuarterHour;
            
            return (
              <div 
                key={`time-${timeString}`}
                className={`absolute text-xs text-right pr-2 bg-background flex items-center justify-end ${
                  !hasLabel ? 'opacity-0' : // Hide labels for preview slots
                  isHourMark ? 'font-medium' : 
                  isHalfHour ? 'text-muted-foreground' :
                  isQuarterHour ? 'text-muted-foreground/80' :
                  'text-muted-foreground/60'
                }`}
                style={{ 
                  top: `${i * slotHeight - (slotHeight / 2)}px`,
                  left: 0,
                  right: 0,
                  height: `${slotHeight}px`,
                  zIndex: 20
                }}
              >
                {hasLabel && timeString !== "00:00" ? timeString : ""}
              </div>
            );
          })}
          
          
          {/* Drag instructions when zoomed */}
          {isZoomActive && isActuallyZoomed && isHoveringTimeline && !isDraggingZoom && (
            <div className="absolute top-1 right-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded z-30">
              Drag to move
            </div>
          )}
          
          {/* Zoom active indicator */}
          {isZoomActive && isActuallyZoomed && (
            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-md z-30 flex items-center gap-2">
              <span>Zoomed: {String(zoomWindow.startHour).padStart(2, '0')}:00 - {String(zoomWindow.endHour).padStart(2, '0')}:00</span>
              <button
                onClick={() => {
                  setZoomWindow({ startHour: 0, endHour: 24, windowHeight: 300 });
                  setIsZoomActive(false);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-1 py-0.5 rounded"
                title="Clear zoom"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, dayIndex) => (
            <DayColumn
              key={day.toString()}
              day={day}
              dayIndex={dayIndex}
              calendarHeight={calendarHeight}
              slotHeight={slotHeight}
              timeSlots={timeSlots}
              isZoomActive={isZoomActive}
              zoomWindow={zoomWindow}
              renderCurrentTimeLine={renderCurrentTimeLine}
              renderEvents={renderEvents}
              renderDragHelper={renderDragHelper}
              handleDayClick={handleDayClick}
              dropHoverPosition={dropHoverPosition}
              onTaskDrop={onTaskDrop}
              calculateTimeFromPosition={calculateTimeFromPosition}
              setDropHoverPosition={setDropHoverPosition}
              currentDragData={flexyDND.currentDragData}
              dragPosition={dragPosition}
            />
          ))}
        </div>
      </div>
      
      {/* Event Group Modal */}
      {/* Click-to-open modal */}
      <EventGroupModal
        isOpen={isGroupModalOpen}
        onOpenChange={setIsGroupModalOpen}
        groupEvent={selectedGroupEvent}
        childEvents={getChildEventsForGroupInstance(selectedGroupEvent, events)}
        calendars={calendars?.map(cal => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          is_visible: cal.isVisible,
          is_default: false,
          created_at: '',
          updated_at: '',
          user_id: '',
        })) || []}
        onEditGroup={(event) => {
          openEditDialog(event);
        }}
        onEventClick={(event) => {
          // Check if this is a virtual recurrence instance of a child event
          const isRecurrenceInstance = event.id.includes('-recurrence-');
          
          if (isRecurrenceInstance) {
            // Find the master event for this child
            const masterEventId = event.id.split('-recurrence-')[0];
            const masterEvent = events.find(e => e.id === masterEventId);
            
            if (masterEvent) {
              // Check if the master event's parent group is recurring
              const parentGroupId = masterEvent.parent_group_event_id;
              const parentGroup = parentGroupId ? events.find(e => e.id === parentGroupId) : null;
              
              if (parentGroup) {
                const parentRecurrencePattern = getRecurrencePattern(parentGroup);
                const isParentRecurring = parentRecurrencePattern && 
                  parentRecurrencePattern.frequency !== RecurrenceFrequency.None;
                
                if (isParentRecurring) {
                  // This is a child event in a recurring group
                  // Open the dialog with the master event but mark it as a recurring instance
                  openEditDialog({
                    ...masterEvent,
                    clickedOccurrenceDate: event.start_time, // start_time of the clicked instance
                    isRecurrenceInstance: true // Mark it as an instance for the dialog
                  } as CalendarEvent);
                  return;
                }
              }
            }
          }
          
          // For non-recurring child events or regular events, just open the dialog normally
          openEditDialog(event);
        }}
        onEventUpdate={onEventUpdate}
      />
      
      {/* Drag hover modal */}
      <EventGroupModal
        isOpen={isDragHoverModalOpen}
        onOpenChange={setIsDragHoverModalOpen}
        groupEvent={selectedGroupEvent}
        childEvents={getChildEventsForGroupInstance(selectedGroupEvent, events)}
        calendars={calendars?.map(cal => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          is_visible: cal.isVisible,
          is_default: false,
          created_at: '',
          updated_at: '',
          user_id: '',
        })) || []}
        onEditGroup={(event) => {
          openEditDialog(event);
        }}
        onEventClick={(event) => {
          // Check if this is a virtual recurrence instance of a child event
          const isRecurrenceInstance = event.id.includes('-recurrence-');
          
          if (isRecurrenceInstance) {
            // Find the master event for this child
            const masterEventId = event.id.split('-recurrence-')[0];
            const masterEvent = events.find(e => e.id === masterEventId);
            
            if (masterEvent) {
              // Check if the master event's parent group is recurring
              const parentGroupId = masterEvent.parent_group_event_id;
              const parentGroup = parentGroupId ? events.find(e => e.id === parentGroupId) : null;
              
              if (parentGroup) {
                const parentRecurrencePattern = getRecurrencePattern(parentGroup);
                const isParentRecurring = parentRecurrencePattern && 
                  parentRecurrencePattern.frequency !== RecurrenceFrequency.None;
                
                if (isParentRecurring) {
                  // This is a child event in a recurring group
                  // Open the dialog with the master event but mark it as a recurring instance
                  openEditDialog({
                    ...masterEvent,
                    clickedOccurrenceDate: event.start_time, // start_time of the clicked instance
                    isRecurrenceInstance: true // Mark it as an instance for the dialog
                  } as CalendarEvent);
                  return;
                }
              }
            }
          }
          
          // For non-recurring child events or regular events, just open the dialog normally
          openEditDialog(event);
        }}
        onEventUpdate={onEventUpdate}
        externalDragEvent={activeEvent?.event || null}
        onExternalDrop={(event, newStartTime, newEndTime) => {
          if (!onEventUpdate || !selectedGroupEvent) return;
          
          // Update the event with new times and assign to group
          const updatedEvent: CalendarEvent = {
            ...event,
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString(),
            parent_group_event_id: selectedGroupEvent.id,
            updated_at: new Date().toISOString(),
          };
          
          onEventUpdate(updatedEvent);
          
          // Clean up drag state
          setActiveEvent(null);
          setDragPosition(null);
          setIsDragHoverModalOpen(false);
          isDraggingRef.current = false;
        }}
      />
    </div>
  );
}
