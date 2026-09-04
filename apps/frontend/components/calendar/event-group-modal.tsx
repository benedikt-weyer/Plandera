'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format, differenceInMinutes, addMinutes } from 'date-fns';
import { CalendarClock, Edit, X } from 'lucide-react';

interface EventGroupModalProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly groupEvent: CalendarEvent | null;
  readonly childEvents: CalendarEvent[];
  readonly calendars: Calendar[];
  readonly onEditGroup: (event: CalendarEvent) => void;
  readonly onEventClick: (event: CalendarEvent) => void;
  readonly onEventUpdate?: (event: CalendarEvent) => void;
  readonly externalDragEvent?: CalendarEvent | null; // Event being dragged from outside
  readonly onExternalDrop?: (event: CalendarEvent, newStartTime: Date, newEndTime: Date) => void; // Handle external drop
}

interface DragState {
  event: CalendarEvent;
  initialY: number;
  initialStartTime: Date;
  eventDuration: number;
}

export function EventGroupModal({
  isOpen,
  onOpenChange,
  groupEvent,
  childEvents,
  calendars,
  onEditGroup,
  onEventClick,
  onEventUpdate,
  externalDragEvent,
  onExternalDrop,
}: EventGroupModalProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ top: number; height: number } | null>(null);
  const [externalDragPosition, setExternalDragPosition] = useState<{ top: number; height: number } | null>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Calculate values before useEffect (needed for dependency array)
  const calendar = groupEvent ? calendars.find(cal => cal.id === groupEvent.calendar_id) : null;
  const bgColor = calendar?.color || '#3b82f6';
  const isTaskReservationSpace = Boolean(groupEvent?.is_task_reservation_space);

  // Calculate the time range for the group (with fallbacks for hook dependencies)
  const groupStart = groupEvent ? new Date(groupEvent.start_time) : new Date();
  const groupEnd = groupEvent ? new Date(groupEvent.end_time) : new Date();
  const totalMinutes = differenceInMinutes(groupEnd, groupStart);

  // Calculate time grid interval (needed for useEffect dependency)
  const groupLengthHours = totalMinutes / 60;
  const timeGridInterval = groupLengthHours <= 2 ? 15 : groupLengthHours <= 6 ? 30 : 60;

  // Handle drag movement and drop
  useEffect(() => {
    if (!dragState || !onEventUpdate) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!eventsContainerRef.current) return;
      
      const dx = Math.abs(e.clientX - dragState.initialY);
      const dy = Math.abs(e.clientY - dragState.initialY);
      
      if (dx > 5 || dy > 5) {
        isDraggingRef.current = true;
      }
      
      if (!isDraggingRef.current) return;

      const rect = eventsContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const relativeX = e.clientX - rect.left;
      
      // Check if mouse is outside the container bounds
      const margin = 20; // pixels
      const isOutside = 
        relativeY < -margin || 
        relativeY > rect.height + margin ||
        relativeX < -margin ||
        relativeX > rect.width + margin;
      
      if (isOutside) {
        // Remove from group and close modal
        const updatedEvent: CalendarEvent = {
          ...dragState.event,
          parent_group_event_id: undefined,
          updated_at: new Date().toISOString(),
        };
        onEventUpdate(updatedEvent);
        
        // Clean up
        setDragState(null);
        setDragPreviewPosition(null);
        isDraggingRef.current = false;
        onOpenChange(false);
        return;
      }
      
      const pixelsPerMinute = rect.height / totalMinutes;
      
      // Calculate minutes from top based on mouse position
      const minutesFromTop = Math.max(0, Math.min(totalMinutes, relativeY / pixelsPerMinute));
      
      // Snap to appropriate intervals based on grid
      const snapInterval = Math.min(15, timeGridInterval); // Use 15 min max for dragging
      const snappedMinutes = Math.round(minutesFromTop / snapInterval) * snapInterval;
      
      // Calculate new position percentage
      const topPercent = (snappedMinutes / totalMinutes) * 100;
      const heightPercent = Math.min(100 - topPercent, (dragState.eventDuration / totalMinutes) * 100);
      
      setDragPreviewPosition({
        top: topPercent,
        height: heightPercent,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const wasDragging = isDraggingRef.current;
      
      if (wasDragging && eventsContainerRef.current) {
        // Calculate final position
        const rect = eventsContainerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const pixelsPerMinute = rect.height / totalMinutes;
        
        const minutesFromTop = Math.max(0, Math.min(totalMinutes - dragState.eventDuration, relativeY / pixelsPerMinute));
        const snapInterval = Math.min(15, timeGridInterval); // Use 15 min max for dragging
        const snappedMinutes = Math.round(minutesFromTop / snapInterval) * snapInterval;
        
        // Calculate new start and end times
        const newStartTime = addMinutes(groupStart, snappedMinutes);
        const newEndTime = addMinutes(newStartTime, dragState.eventDuration);
        
        // Update the event
        const updatedEvent: CalendarEvent = {
          ...dragState.event,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        onEventUpdate(updatedEvent);
        
        // Reset drag state after a short delay
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      } else {
        // If we didn't drag, reset immediately
        isDraggingRef.current = false;
      }
      
      setDragState(null);
      setDragPreviewPosition(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        // Remove from group and close modal
        const updatedEvent: CalendarEvent = {
          ...dragState.event,
          parent_group_event_id: undefined,
          updated_at: new Date().toISOString(),
        };
        onEventUpdate(updatedEvent);
        
        // Clean up
        setDragState(null);
        setDragPreviewPosition(null);
        isDraggingRef.current = false;
        onOpenChange(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, onEventUpdate, totalMinutes, groupStart, timeGridInterval, onOpenChange]);

  // Initialize external drag position when modal opens with external drag event
  useEffect(() => {
    if (!externalDragEvent || !eventsContainerRef.current || !isOpen) {
      return;
    }

    // Get current mouse position and calculate initial position
    const initializePosition = (e: MouseEvent) => {
      if (!eventsContainerRef.current) return;

      const rect = eventsContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Only initialize if mouse is within bounds
      if (relativeY >= 0 && relativeY <= rect.height) {
        const pixelsPerMinute = rect.height / totalMinutes;
        const minutesFromTop = Math.max(0, Math.min(totalMinutes, relativeY / pixelsPerMinute));
        const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
        
        const eventStart = new Date(externalDragEvent.start_time);
        const eventEnd = new Date(externalDragEvent.end_time);
        const eventDuration = differenceInMinutes(eventEnd, eventStart);
        
        const topPercent = (snappedMinutes / totalMinutes) * 100;
        const heightPercent = Math.min(100 - topPercent, (eventDuration / totalMinutes) * 100);
        
        setExternalDragPosition({
          top: topPercent,
          height: heightPercent,
        });
      }
    };

    // Capture the first mousemove to initialize position
    const handleInitialMove = (e: MouseEvent) => {
      initializePosition(e);
      document.removeEventListener('mousemove', handleInitialMove);
    };

    document.addEventListener('mousemove', handleInitialMove);

    return () => {
      document.removeEventListener('mousemove', handleInitialMove);
    };
  }, [externalDragEvent, isOpen, totalMinutes]);

  // Handle external drag event tracking
  useEffect(() => {
    if (!externalDragEvent || !eventsContainerRef.current || !onExternalDrop) {
      setExternalDragPosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!eventsContainerRef.current) return;

      const rect = eventsContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const relativeX = e.clientX - rect.left;
      
      // Check if mouse is within the container bounds (with some margin)
      const margin = 20; // pixels
      const isOutside = 
        relativeY < -margin || 
        relativeY > rect.height + margin ||
        relativeX < -margin ||
        relativeX > rect.width + margin;
      
      if (isOutside) {
        setExternalDragPosition(null);
        // Close the modal when dragging outside
        onOpenChange(false);
        return;
      }

      const pixelsPerMinute = rect.height / totalMinutes;
      
      // Calculate minutes from top based on mouse position
      const minutesFromTop = Math.max(0, Math.min(totalMinutes, relativeY / pixelsPerMinute));
      
      // Snap to 15-minute intervals
      const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
      
      // Calculate event duration
      const eventStart = new Date(externalDragEvent.start_time);
      const eventEnd = new Date(externalDragEvent.end_time);
      const eventDuration = differenceInMinutes(eventEnd, eventStart);
      
      // Calculate new position percentage
      const topPercent = (snappedMinutes / totalMinutes) * 100;
      const heightPercent = Math.min(100 - topPercent, (eventDuration / totalMinutes) * 100);
      
      setExternalDragPosition({
        top: topPercent,
        height: heightPercent,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!eventsContainerRef.current || !externalDragPosition) return;

      const rect = eventsContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Check if mouse is within the container bounds
      if (relativeY >= 0 && relativeY <= rect.height && externalDragPosition) {
        // Stop propagation so the calendar's drag handler doesn't run
        e.stopPropagation();
        
        // Calculate the new start and end times based on the preview position
        const newStartMinutes = (externalDragPosition.top / 100) * totalMinutes;
        const newStartTime = addMinutes(groupStart, newStartMinutes);
        
        const eventStart = new Date(externalDragEvent.start_time);
        const eventEnd = new Date(externalDragEvent.end_time);
        const eventDuration = differenceInMinutes(eventEnd, eventStart);
        const newEndTime = addMinutes(newStartTime, eventDuration);
        
        // Call the external drop handler
        onExternalDrop(externalDragEvent, newStartTime, newEndTime);
      }
      
      setExternalDragPosition(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    // Use capture phase to ensure modal's handler runs before calendar's
    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [externalDragEvent, totalMinutes, groupStart, externalDragPosition, onExternalDrop, onOpenChange]);

  // Early return after all hooks to comply with Rules of Hooks
  if (!groupEvent) return null;

  // Generate time marks - always include start and end times
  const timeMarks: Array<{ time: Date; label: string; isMainMark: boolean }> = [];
  
  // Always add the start time
  timeMarks.push({
    time: new Date(groupStart),
    label: format(groupStart, 'HH:mm'),
    isMainMark: true,
  });
  
  // Calculate intermediate marks aligned to clock hours
  const firstHourStart = new Date(groupStart);
  firstHourStart.setMinutes(0, 0, 0);
  if (firstHourStart < groupStart) {
    firstHourStart.setHours(firstHourStart.getHours() + 1);
  }
  
  let currentTime = new Date(firstHourStart);
  
  while (currentTime < groupEnd) {
    const minutesFromGroupStart = differenceInMinutes(currentTime, groupStart);
    if (minutesFromGroupStart > 0 && minutesFromGroupStart < totalMinutes) {
      const minutes = currentTime.getMinutes();
      const isMainMark = minutes === 0; // Full hours are main marks
      
      timeMarks.push({
        time: new Date(currentTime),
        label: format(currentTime, 'HH:mm'),
        isMainMark,
      });
    }
    currentTime = addMinutes(currentTime, timeGridInterval);
  }
  
  // Always add the end time (if not already added)
  const lastMarkTime = timeMarks[timeMarks.length - 1]?.time;
  if (!lastMarkTime || differenceInMinutes(groupEnd, lastMarkTime) > 1) {
    timeMarks.push({
      time: new Date(groupEnd),
      label: format(groupEnd, 'HH:mm'),
      isMainMark: true,
    });
  }

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
    if (!onEventUpdate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const eventDuration = differenceInMinutes(eventEnd, eventStart);
    
    setDragState({
      event,
      initialY: e.clientY,
      initialStartTime: eventStart,
      eventDuration,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: bgColor }}
                />
                <DialogTitle className="text-xl font-semibold">
                  {groupEvent.title}
                </DialogTitle>
              </div>
              {isTaskReservationSpace ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Task Reservation Space
                </div>
              ) : (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Event Group
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {isTaskReservationSpace
                  ? 'Autoplan and manual scheduling can place task events into this reserved time block.'
                  : 'This event group can contain other events and keeps them organized within the same time block.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEditGroup(groupEvent);
                  onOpenChange(false);
                }}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit Group
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-4">
              <span>
                {format(groupStart, 'PPP')}
              </span>
              <span>
                {format(groupStart, 'HH:mm')} - {format(groupEnd, 'HH:mm')}
              </span>
              {groupEvent.location && (
                <span className="flex items-center gap-1">
                  📍 {groupEvent.location}
                </span>
              )}
            </div>
            {groupEvent.description && (
              <p className="mt-2 text-sm">{groupEvent.description}</p>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden mt-4 min-h-0">
          <div className="mb-3 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-medium text-muted-foreground">
              Events in this group ({childEvents.length})
            </h3>
          </div>

          {childEvents.length === 0 && !externalDragEvent ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4 opacity-50"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <p className="text-sm">No events in this group yet</p>
              <p className="text-xs mt-1">Drag events onto this group to add them</p>
            </div>
          ) : (
            <div className="relative flex-1 border rounded-lg overflow-hidden">
              <div className="relative h-full bg-muted/5">
                {/* Time labels on the left */}
                <div className="absolute left-0 top-0 bottom-0 w-16 border-r bg-background/95 backdrop-blur-sm">
                  {timeMarks.map((mark, i) => {
                    const minutesFromStart = differenceInMinutes(mark.time, groupStart);
                    const topPercent = (minutesFromStart / totalMinutes) * 100;
                    
                    // Adjust positioning for first and last labels to prevent cutoff
                    let transform = 'translateY(-50%)';
                    if (topPercent === 0) {
                      transform = 'translateY(0)'; // Align top for first label
                    } else if (topPercent === 100) {
                      transform = 'translateY(-100%)'; // Align bottom for last label
                    }
                    
                    return (
                      <div
                        key={i}
                        className={`absolute w-full text-xs text-right pr-2 ${
                          mark.isMainMark ? 'text-foreground font-medium' : 'text-muted-foreground'
                        }`}
                        style={{ top: `${topPercent}%`, transform }}
                      >
                        {mark.label}
                      </div>
                    );
                  })}
                </div>

                {/* Events container */}
                <div ref={eventsContainerRef} className="ml-16 relative h-full">
                  {/* Grid lines */}
                  {timeMarks.map((mark, i) => {
                    const minutesFromStart = differenceInMinutes(mark.time, groupStart);
                    if (minutesFromStart === 0) return null; // Skip first line at top
                    const topPercent = (minutesFromStart / totalMinutes) * 100;
                    
                    return (
                      <div
                        key={`grid-${i}`}
                        className={`absolute left-0 right-0 border-t ${
                          mark.isMainMark ? 'border-border/50' : 'border-border/20'
                        }`}
                        style={{ top: `${topPercent}%` }}
                      />
                    );
                  })}

                  {childEvents.map(event => {
                    // Skip rendering the event being dragged in its original position
                    if (dragState && event.id === dragState.event.id && isDraggingRef.current) {
                      return null;
                    }
                    
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    const eventCalendar = calendars.find(cal => cal.id === event.calendar_id);
                    const eventColor = eventCalendar?.color || '#3b82f6';

                    // Calculate position within the group
                    const minutesFromStart = differenceInMinutes(eventStart, groupStart);
                    const eventDuration = differenceInMinutes(eventEnd, eventStart);
                    
                    const topPercent = Math.max(0, (minutesFromStart / totalMinutes) * 100);
                    const heightPercent = Math.min(100 - topPercent, (eventDuration / totalMinutes) * 100);

                    return (
                      <div
                        key={event.id}
                        className={`absolute left-2 right-2 rounded-md px-3 py-2 transition-shadow ${
                          onEventUpdate ? 'cursor-move hover:shadow-md' : 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
                        }`}
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          minHeight: '40px',
                          backgroundColor: eventColor,
                          color: 'white',
                        }}
                        onMouseDown={(e) => {
                          if (onEventUpdate) {
                            handleMouseDown(e, event);
                          }
                        }}
                        onClick={(e) => {
                          if (!isDraggingRef.current) {
                            onEventClick(event);
                            onOpenChange(false);
                          }
                        }}
                      >
                        <div className="font-medium text-sm truncate">
                          {event.title}
                        </div>
                        {heightPercent > 8 && (
                          <div className="text-xs opacity-90 truncate">
                            {format(eventStart, 'HH:mm')} - {format(eventEnd, 'HH:mm')}
                          </div>
                        )}
                        {heightPercent > 12 && event.location && (
                          <div className="text-xs opacity-80 truncate">
                            📍 {event.location}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Drag preview - internal drag */}
                  {dragState && dragPreviewPosition && isDraggingRef.current && (
                    <div
                      className="absolute left-2 right-2 rounded-md px-3 py-2 opacity-60 pointer-events-none border-2 border-white"
                      style={{
                        top: `${dragPreviewPosition.top}%`,
                        height: `${dragPreviewPosition.height}%`,
                        minHeight: '40px',
                        backgroundColor: calendars.find(cal => cal.id === dragState.event.calendar_id)?.color || '#3b82f6',
                        color: 'white',
                        zIndex: 1000,
                      }}
                    >
                      <div className="font-medium text-sm truncate">
                        {dragState.event.title}
                      </div>
                      {dragPreviewPosition.height > 8 && (
                        <div className="text-xs opacity-90 truncate">
                          {format(addMinutes(groupStart, (dragPreviewPosition.top / 100) * totalMinutes), 'HH:mm')} -{' '}
                          {format(addMinutes(groupStart, (dragPreviewPosition.top / 100) * totalMinutes + dragState.eventDuration), 'HH:mm')}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* External drag preview - event being dragged from outside */}
                  {externalDragEvent && !dragState && externalDragPosition && (
                    (() => {
                      const extEventStart = new Date(externalDragEvent.start_time);
                      const extEventEnd = new Date(externalDragEvent.end_time);
                      const extEventDuration = differenceInMinutes(extEventEnd, extEventStart);
                      
                      // Get event color
                      const extEventCalendar = calendars.find(cal => cal.id === externalDragEvent.calendar_id);
                      const extEventColor = extEventCalendar?.color || '#3b82f6';
                      
                      // Calculate the new start and end times based on position
                      const newStartMinutes = (externalDragPosition.top / 100) * totalMinutes;
                      const newStartTime = addMinutes(groupStart, newStartMinutes);
                      const newEndTime = addMinutes(newStartTime, extEventDuration);
                      
                      return (
                        <div
                          className="absolute left-2 right-2 rounded-md px-3 py-2 opacity-70 pointer-events-none border-2 border-white shadow-lg"
                          style={{
                            top: `${externalDragPosition.top}%`,
                            height: `${externalDragPosition.height}%`,
                            minHeight: '40px',
                            backgroundColor: extEventColor,
                            color: 'white',
                            zIndex: 1001,
                          }}
                        >
                          <div className="font-medium text-sm truncate">
                            {externalDragEvent.title}
                          </div>
                          {externalDragPosition.height > 8 && (
                            <div className="text-xs opacity-90 truncate">
                              {format(newStartTime, 'HH:mm')} - {format(newEndTime, 'HH:mm')}
                            </div>
                          )}
                          {externalDragPosition.height > 12 && externalDragEvent.location && (
                            <div className="text-xs opacity-80 truncate">
                              📍 {externalDragEvent.location}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
