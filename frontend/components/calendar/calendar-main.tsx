"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useLocalStorage, useLocalStorageDate } from "@/hooks/useLocalStorage";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";
import { CalendarEventDialog, EventFormValues } from "./calendar-event-dialog";
import { RecurringEventModificationDialog } from "./recurring-event-modification-dialog";
import { CalendarSidebar } from "./calendar-sidebar";
import { CalendarHeaderMobile } from "./calendar-header-mobile";
import { useWeekStartDay } from "@/stores/settings-store";
import { CalendarGridMobile } from "./calendar-grid-mobile";
import { CalendarDayAgenda } from "./calendar-day-agenda";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { useCalendar } from "@/stores/calendar-store";

import {
  CalendarEvent,
  Calendar,
  CalendarView,
  RecurrenceFrequency,
} from "@/utils/calendar/calendar-types";
import {
  getEventsInDay,
  getDaysOfWeek,
  getEventsInMonth,
  getEventsInWeek,
} from "@/utils/calendar/calendarHelpers";
import { getRecurrencePattern } from "@/utils/calendar/eventDataProcessing";
import { startOfDay, startOfWeek } from "date-fns";
import { ProjectDecrypted } from "@/utils/api/types";

export interface CalendarMainProps {
  // Data
  calendars: Calendar[];
  events: CalendarEvent[];
  icsEvents: CalendarEvent[];
  isLoading: boolean;
  error?: string | null;
  tasks?: any[]; // Can-do list tasks for event-task linking
  projects?: ProjectDecrypted[];
  onNavigateToTask?: (taskId: string) => void;
  onCreateTaskFromEvent?: (
    eventId: string,
    title: string,
    projectId: string | null,
  ) => Promise<void>;

  // State props (optional - component can manage its own state if not provided)
  currentWeek?: Date;
  setCurrentWeek?: React.Dispatch<React.SetStateAction<Date>>;
  selectedDate?: Date;
  setSelectedDate?: React.Dispatch<React.SetStateAction<Date>>;
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  selectedEvent?: CalendarEvent | null;
  setSelectedEvent?: (event: CalendarEvent | null) => void;
  shouldSelectToday?: boolean;
  setShouldSelectToday?: (should: boolean) => void;

  // Calendar handlers
  onCalendarToggle: (calendarId: string, isVisible: boolean) => Promise<void>;
  onCalendarCreate: (name: string, color: string) => Promise<Calendar>;
  onICSCalendarCreate: (
    name: string,
    color: string,
    icsUrl: string,
  ) => Promise<Calendar>;
  onICSCalendarRefresh: (calendarId: string) => Promise<void>;
  onCalendarEdit: (id: string, name: string, color: string) => Promise<void>;
  onCalendarDelete: (calendarId: string) => Promise<string | undefined>;
  onSetDefaultCalendar: (calendarId: string) => Promise<void>;

  // Event handlers
  onSubmitEvent: (values: EventFormValues) => Promise<boolean>;
  onDeleteEvent: (id: string) => Promise<boolean>;
  onCloneEvent: (event: CalendarEvent) => Promise<boolean>;
  onEventUpdate: (updatedEvent: CalendarEvent) => Promise<boolean>;
  moveEventToCalendar: (
    eventId: string,
    targetCalendarId: string,
  ) => Promise<void>;
  onTaskSchedule?: (
    taskId: string,
    startTime: Date,
    durationMinutes: number,
  ) => Promise<void>;

  // Recurrence event handlers
  onDeleteThisOccurrence?: (event: CalendarEvent) => Promise<boolean>;
  onDeleteThisAndFuture?: (event: CalendarEvent) => Promise<boolean>;
  onModifyThisOccurrence?: (
    event: CalendarEvent,
    modifiedData: any,
  ) => Promise<boolean>;
  onModifyThisAndFuture?: (
    event: CalendarEvent,
    modifiedData: any,
  ) => Promise<boolean>;
  onModifyAllInSeries?: (
    event: CalendarEvent,
    modifiedData: any,
  ) => Promise<boolean>;

  // ICS handlers
  onRefreshICSCalendar: (calendarId: string) => Promise<void>;
  isICSEvent: (event: CalendarEvent) => boolean;
  isReadOnlyCalendar: (calendarId: string) => boolean;

  // Optional custom class names
  className?: string;

  // Optional loading text
  loadingText?: string;
}

export function CalendarMain({
  // Data
  calendars,
  events,
  icsEvents,
  isLoading,
  error,
  tasks,
  projects,
  onNavigateToTask,
  onCreateTaskFromEvent,

  // State props (with defaults for internal state management)
  currentWeek: propCurrentWeek,
  setCurrentWeek: propSetCurrentWeek,
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate,
  isDialogOpen: propIsDialogOpen,
  setIsDialogOpen: propSetIsDialogOpen,
  selectedEvent: propSelectedEvent,
  setSelectedEvent: propSetSelectedEvent,
  shouldSelectToday: propShouldSelectToday,
  setShouldSelectToday: propSetShouldSelectToday,

  // Calendar handlers
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,

  // Event handlers
  onSubmitEvent,
  onDeleteEvent,
  onCloneEvent,
  onEventUpdate,
  moveEventToCalendar,
  onTaskSchedule,

  // Recurrence event handlers
  onDeleteThisOccurrence,
  onDeleteThisAndFuture,
  onModifyThisOccurrence,
  onModifyThisAndFuture,
  onModifyAllInSeries,

  // ICS handlers
  onRefreshICSCalendar,
  isICSEvent,
  isReadOnlyCalendar,

  // Optional props
  className = "",
  loadingText = "Loading your calendar...",
}: CalendarMainProps) {
  const weekStartsOn = useWeekStartDay();
  const currentWeekTimestamp = useCalendar(
    (state) => state.currentWeekTimestamp,
  );
  const setStoreCurrentWeek = useCalendar((state) => state.setCurrentWeek);
  // Convert timestamp to Date for reactive updates
  const storeCurrentWeek = currentWeekTimestamp
    ? new Date(currentWeekTimestamp)
    : null;

  // Internal state management (only used if props not provided)
  // Use persistent storage for calendar state to remember user's last position
  const [internalCurrentWeek, setInternalCurrentWeek, isWeekHydrated] =
    useLocalStorageDate(
      "calendar-current-week",
      startOfWeek(new Date(), { weekStartsOn }),
    );
  const [internalSelectedDate, setInternalSelectedDate, isDateHydrated] =
    useLocalStorageDate("calendar-selected-date", new Date());
  const [calendarView, setCalendarView] = useLocalStorage<CalendarView>(
    "calendar-view",
    "week",
  );
  const [internalIsDialogOpen, setInternalIsDialogOpen] =
    useState<boolean>(false);
  const [internalSelectedEvent, setInternalSelectedEvent] =
    useState<CalendarEvent | null>(null);
  const [internalShouldSelectToday, setInternalShouldSelectToday] =
    useState<boolean>(false);

  // Initialize store with initial week if not set, but only after localStorage has loaded
  useEffect(() => {
    if (!storeCurrentWeek && isWeekHydrated) {
      const initialWeek = propCurrentWeek ?? internalCurrentWeek;
      setStoreCurrentWeek(initialWeek);
    }
  }, [isWeekHydrated]); // Only run when hydration completes

  // Sync store changes back to local storage and props
  useEffect(() => {
    if (storeCurrentWeek) {
      // Sync to props if provided
      if (propSetCurrentWeek) {
        const currentTime = storeCurrentWeek.getTime();
        const propTime = propCurrentWeek?.getTime();
        if (currentTime !== propTime) {
          propSetCurrentWeek(storeCurrentWeek);
        }
      } else {
        // Sync to internal state (local storage)
        const currentTime = storeCurrentWeek.getTime();
        const internalTime = internalCurrentWeek.getTime();
        if (currentTime !== internalTime) {
          setInternalCurrentWeek(storeCurrentWeek);
        }
      }
    }
  }, [
    storeCurrentWeek,
    propSetCurrentWeek,
    propCurrentWeek,
    internalCurrentWeek,
  ]); // Keep setInternalCurrentWeek out of deps

  // Use store as primary source, with fallback for initial render
  const currentWeek =
    storeCurrentWeek ?? propCurrentWeek ?? internalCurrentWeek;

  // Wrapper to support both direct values and callback functions
  const setCurrentWeek = useCallback(
    (weekOrUpdater: Date | ((prev: Date) => Date)) => {
      if (typeof weekOrUpdater === "function") {
        // If it's a function, call it with current week and use the result
        const newWeek = weekOrUpdater(currentWeek);
        setStoreCurrentWeek(newWeek);
      } else {
        // If it's a direct value, use it
        setStoreCurrentWeek(weekOrUpdater);
      }
    },
    [currentWeek, setStoreCurrentWeek],
  );
  const selectedDate = propSelectedDate ?? internalSelectedDate;
  const setSelectedDate = propSetSelectedDate ?? setInternalSelectedDate;
  const isDialogOpen = propIsDialogOpen ?? internalIsDialogOpen;
  const setIsDialogOpen = propSetIsDialogOpen ?? setInternalIsDialogOpen;
  const selectedEvent = propSelectedEvent ?? internalSelectedEvent;
  const setSelectedEvent = propSetSelectedEvent ?? setInternalSelectedEvent;
  const shouldSelectToday = propShouldSelectToday ?? internalShouldSelectToday;
  const setShouldSelectToday =
    propSetShouldSelectToday ?? setInternalShouldSelectToday;

  // Drag/resize modification modal state
  const [isDragModificationModalOpen, setIsDragModificationModalOpen] =
    useState(false);
  const [pendingDraggedEvent, setPendingDraggedEvent] =
    useState<CalendarEvent | null>(null);
  const [originalEventBeforeDrag, setOriginalEventBeforeDrag] =
    useState<CalendarEvent | null>(null);

  // When week start day setting changes, recalculate the current week
  // Only recalculate if weekStartsOn changes, not when selectedDate changes
  // (to avoid conflicting with store-driven navigation)
  useEffect(() => {
    const newWeekStart = startOfWeek(currentWeek, { weekStartsOn });
    if (newWeekStart.getTime() !== currentWeek.getTime()) {
      setCurrentWeek(newWeekStart);
    }
  }, [weekStartsOn]); // Removed selectedDate and currentWeek from deps

  // Calculate derived data using useMemo to avoid unnecessary recalculations
  const daysOfWeek = useMemo(
    () => getDaysOfWeek(currentWeek, weekStartsOn),
    [currentWeek, weekStartsOn],
  );

  // Combine regular events and ICS events
  const allEvents = useMemo(() => {
    return [...events, ...icsEvents];
  }, [events, icsEvents]);

  // First filter events by visible calendars, then get events for current week
  const visibleEvents = useMemo(() => {
    const filtered = allEvents.filter((event) => {
      const calendar = calendars.find((cal) => cal.id === event.calendar_id);
      const isVisible = calendar?.is_visible ?? false;
      return isVisible;
    });

    return filtered;
  }, [allEvents, calendars]);

  const eventsInCurrentWeek = useMemo(() => {
    const weekEvents = getEventsInWeek(
      visibleEvents,
      daysOfWeek[0],
      weekStartsOn,
    );
    return weekEvents;
  }, [visibleEvents, daysOfWeek, weekStartsOn]);

  const eventsInCurrentMonth = useMemo(() => {
    return getEventsInMonth(visibleEvents, selectedDate, weekStartsOn);
  }, [visibleEvents, selectedDate, weekStartsOn]);

  const eventsInCurrentDay = useMemo(() => {
    return getEventsInDay(visibleEvents, selectedDate);
  }, [visibleEvents, selectedDate]);

  const calendarRenderData = useMemo(
    () =>
      calendars.map((cal) => ({
        ...cal,
        color: cal.color || "#3b82f6",
        isVisible: cal.is_visible,
      })),
    [calendars],
  );

  // Memoize filtered visible calendars to avoid recalculating on each render
  const visibleCalendars = useMemo(
    () => calendars.filter((cal) => cal.is_visible),
    [calendars],
  );

  // Memoize default calendar ID lookup
  const defaultCalendarId = useMemo(
    () => calendars.find((cal) => cal.is_default)?.id,
    [calendars],
  );

  // Memoize fallback calendar ID for new events
  const fallbackCalendarId = useMemo(
    () => defaultCalendarId ?? (calendars.length > 0 ? calendars[0].id : ""),
    [defaultCalendarId, calendars],
  );

  // Handle calendar deletion with event moving
  const handleCalendarDeleteWithEvents = useCallback(
    async (calendarId: string) => {
      try {
        // Delete the calendar and get the target calendar ID for moving events
        const targetCalendarId = await onCalendarDelete(calendarId);

        if (targetCalendarId) {
          // Move all events from this calendar to the target calendar
          const eventsToMove = events.filter(
            (event) => event.calendar_id === calendarId,
          );
          for (const event of eventsToMove) {
            await moveEventToCalendar(event.id, targetCalendarId);
          }
        }
      } catch (error) {
        console.error("Error in handleCalendarDeleteWithEvents:", error);
        throw error;
      }
    },
    [onCalendarDelete, moveEventToCalendar, events],
  );

  // Handle ICS calendar refresh
  const handleICSCalendarRefreshWrapper = useCallback(
    async (calendarId: string) => {
      try {
        await onICSCalendarRefresh(calendarId);
        await onRefreshICSCalendar(calendarId);
      } catch (error) {
        console.error("Error refreshing ICS calendar:", error);
        throw error;
      }
    },
    [onICSCalendarRefresh, onRefreshICSCalendar],
  );

  // Keep selectedEvent in sync with the live events list so that fields like
  // task_id updated externally (e.g. after creating a task from an event) are
  // reflected immediately without needing to reopen the dialog.
  useEffect(() => {
    if (!selectedEvent) return;
    const fresh = events.find((e) => e.id === selectedEvent.id);
    if (fresh && fresh !== selectedEvent) {
      setSelectedEvent(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Open dialog for editing an event
  const openEditDialog = useCallback(
    (event: CalendarEvent) => {
      // Allow viewing ICS events in read-only mode
      setSelectedEvent(event);
      setIsDialogOpen(true);
    },
    [setSelectedEvent, setIsDialogOpen],
  );

  // Open dialog for creating a new event
  const openNewEventDialog = useCallback(
    (day?: Date, isAllDay?: boolean, calendarId?: string) => {
      // If a specific calendar is provided, check if it's read-only
      if (calendarId && isReadOnlyCalendar(calendarId)) {
        console.error("Cannot create events in ICS calendars");
        return;
      }

      setSelectedEvent(null);

      // If a day is provided, set the start time to the clicked time
      if (day) {
        const startTime = new Date(day);

        // For all-day events, set to start of day and end at end of day
        // For timed events, set end time to be 1 hour after start time
        const endTime = new Date(startTime);
        if (isAllDay) {
          // For all-day events, set start to beginning of day and end to end of day
          startTime.setHours(0, 0, 0, 0);
          endTime.setDate(endTime.getDate());
          endTime.setHours(23, 59, 59, 999);
        } else {
          endTime.setHours(endTime.getHours() + 1);
        }

        // Create a temporary "dummy" event to pass to the form
        const dummyEvent: CalendarEvent = {
          id: "new", // This ID will never be used, it's just for the temporary object
          title: "",
          description: "",
          calendar_id: calendarId ?? fallbackCalendarId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          all_day: isAllDay ?? false,
          user_id: "", // Temporary value for dummy event
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Set as selected event to prefill the form with these times
        setSelectedEvent(dummyEvent);
      }

      setIsDialogOpen(true);
    },
    [fallbackCalendarId, isReadOnlyCalendar, setSelectedEvent, setIsDialogOpen],
  );

  // Handle submit event and close dialog
  const onSubmitEventHandler = useCallback(
    async (values: EventFormValues) => {
      // Prevent editing ICS events
      if (values.id && isICSEvent({ id: values.id } as CalendarEvent)) {
        console.error("Events from ICS calendars cannot be edited");
        return;
      }
      // Prevent creating events in ICS calendars
      if (isReadOnlyCalendar(values.calendarId)) {
        console.error("Cannot create events in ICS calendars");
        return;
      }
      const success = await onSubmitEvent(values);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [
      onSubmitEvent,
      isICSEvent,
      isReadOnlyCalendar,
      setSelectedEvent,
      setIsDialogOpen,
    ],
  );

  // Handle delete event and close dialog
  const onDeleteEventHandler = useCallback(
    async (id: string) => {
      // Prevent deleting ICS events
      if (isICSEvent({ id } as CalendarEvent)) {
        console.error("Events from ICS calendars cannot be deleted");
        return;
      }
      const success = await onDeleteEvent(id);
      if (success && selectedEvent?.id === id) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [
      onDeleteEvent,
      selectedEvent,
      isICSEvent,
      setSelectedEvent,
      setIsDialogOpen,
    ],
  );

  // Handle clone event and open edit dialog with cloned event
  const onCloneEventHandler = useCallback(
    async (eventToClone: CalendarEvent) => {
      // Prevent cloning ICS events
      if (isICSEvent(eventToClone)) {
        console.error("Events from ICS calendars cannot be cloned");
        return;
      }
      const success = await onCloneEvent(eventToClone);
      if (success) {
        // Close the current dialog since the event has been cloned
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onCloneEvent, isICSEvent, setSelectedEvent, setIsDialogOpen],
  );

  // Callback for deleting a single occurrence
  const onDeleteThisOccurrenceHandler = useCallback(
    async (event: CalendarEvent) => {
      if (!onDeleteThisOccurrence) return; // Guard if function is not available
      const success = await onDeleteThisOccurrence(event);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onDeleteThisOccurrence, setIsDialogOpen, setSelectedEvent],
  );

  // Callback for deleting this and future occurrences
  const onDeleteThisAndFutureHandler = useCallback(
    async (event: CalendarEvent) => {
      if (!onDeleteThisAndFuture) return; // Guard if function is not available
      const success = await onDeleteThisAndFuture(event);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onDeleteThisAndFuture, setIsDialogOpen, setSelectedEvent],
  );

  // Callback for deleting all events in a series
  const onDeleteAllInSeriesHandler = useCallback(
    async (event: CalendarEvent) => {
      // For recurring events, we need to delete the master event, not the instance
      let masterEventId = event.id;

      // If this is a recurrence instance, extract the master event ID
      if (event.id.includes("-recurrence-")) {
        masterEventId = event.id.split("-recurrence-")[0];
      }

      // Delete the master event (which will delete the entire series)
      const success = await onDeleteEvent(masterEventId);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onDeleteEvent, setIsDialogOpen, setSelectedEvent],
  );

  // Callbacks for modifying recurring events
  const onModifyThisOccurrenceHandler = useCallback(
    async (event: CalendarEvent, modifiedData: any) => {
      if (!onModifyThisOccurrence) return;
      const success = await onModifyThisOccurrence(event, modifiedData);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onModifyThisOccurrence, setIsDialogOpen, setSelectedEvent],
  );

  const onModifyThisAndFutureHandler = useCallback(
    async (event: CalendarEvent, modifiedData: any) => {
      if (!onModifyThisAndFuture) return;
      const success = await onModifyThisAndFuture(event, modifiedData);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onModifyThisAndFuture, setIsDialogOpen, setSelectedEvent],
  );

  const onModifyAllInSeriesHandler = useCallback(
    async (event: CalendarEvent, modifiedData: any) => {
      if (!onModifyAllInSeries) return;
      const success = await onModifyAllInSeries(event, modifiedData);
      if (success) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    },
    [onModifyAllInSeries, setIsDialogOpen, setSelectedEvent],
  );

  // Handler for drag/resize operations that checks for recurring events
  const handleEventUpdateWithRecurrenceCheck = useCallback(
    async (updatedEvent: CalendarEvent) => {
      // Find the original event before drag to calculate the offset
      // For child events (recurrence instances), we need to find the master event
      let originalEvent = events.find((e) => e.id === updatedEvent.id);
      let isVirtualRecurrenceInstance = false;

      if (!originalEvent && updatedEvent.id.includes("-recurrence-")) {
        // This is a recurrence instance, find the master event and calculate the original instance time
        isVirtualRecurrenceInstance = true;
        const masterEventId = updatedEvent.id.split("-recurrence-")[0];
        const masterEvent = events.find((e) => e.id === masterEventId);
        if (masterEvent) {
          // Extract the date from the recurrence instance ID
          const instanceDateStr = updatedEvent.id.split("-recurrence-")[1];
          if (instanceDateStr) {
            try {
              // Parse the instance date and combine it with the master event's time
              const instanceDate = new Date(instanceDateStr);
              const masterStartTime = new Date(masterEvent.start_time);
              const masterEndTime = new Date(masterEvent.end_time);

              // Calculate the duration of the master event
              const duration =
                masterEndTime.getTime() - masterStartTime.getTime();

              // Create the original instance time by combining the instance date with master event's time
              const originalInstanceStartTime = new Date(
                instanceDate.getFullYear(),
                instanceDate.getMonth(),
                instanceDate.getDate(),
                masterStartTime.getHours(),
                masterStartTime.getMinutes(),
                masterStartTime.getSeconds(),
                masterStartTime.getMilliseconds(),
              );

              const originalInstanceEndTime = new Date(
                originalInstanceStartTime.getTime() + duration,
              );

              originalEvent = {
                ...masterEvent,
                id: updatedEvent.id, // Keep the instance ID
                start_time: originalInstanceStartTime.toISOString(),
                end_time: originalInstanceEndTime.toISOString(),
              };
            } catch (error) {
              console.error(
                "Failed to parse instance date:",
                instanceDateStr,
                error,
              );
              // Fallback to master event time
              originalEvent = {
                ...masterEvent,
                id: updatedEvent.id,
              };
            }
          }
        }
      }

      if (originalEvent) {
        setOriginalEventBeforeDrag(originalEvent);
      }

      // Check if this is a recurring event itself
      const recurrencePattern = getRecurrencePattern(updatedEvent);
      const isRecurringEvent =
        recurrencePattern &&
        recurrencePattern.frequency !== RecurrenceFrequency.None;

      // Check if this event is being added to or is already a child of a recurring group
      // Show dialog for both: adding to a recurring group OR modifying an existing child
      let isChildOfRecurringGroup = false;

      if (updatedEvent.parent_group_event_id || isVirtualRecurrenceInstance) {
        // Get the base parent group ID (remove -recurrence suffix if present)
        const baseParentGroupId = updatedEvent.parent_group_event_id?.includes(
          "-recurrence-",
        )
          ? updatedEvent.parent_group_event_id.split("-recurrence-")[0]
          : updatedEvent.parent_group_event_id;

        if (baseParentGroupId) {
          const parentGroup = events.find((e) => e.id === baseParentGroupId);
          if (parentGroup) {
            const parentRecurrencePattern = getRecurrencePattern(parentGroup);
            isChildOfRecurringGroup = !!(
              parentRecurrencePattern &&
              parentRecurrencePattern.frequency !== RecurrenceFrequency.None
            );
          }
        }
      }

      if (isRecurringEvent || isChildOfRecurringGroup) {
        // Store the updated event and show the modification choice modal
        setPendingDraggedEvent(updatedEvent);
        setIsDragModificationModalOpen(true);
        return;
      }

      // For non-recurring events, update directly
      await onEventUpdate(updatedEvent);
    },
    [
      onEventUpdate,
      onModifyAllInSeries,
      onModifyThisAndFuture,
      onModifyThisOccurrence,
      events,
    ],
  );

  // Handlers for drag/resize modification choices
  const handleDragModifyThisOccurrence = useCallback(
    async (event: CalendarEvent) => {
      if (
        pendingDraggedEvent &&
        originalEventBeforeDrag &&
        onModifyThisOccurrence
      ) {
        const modifiedData = {
          title: pendingDraggedEvent.title,
          description: pendingDraggedEvent.description,
          location: pendingDraggedEvent.location,
          start_time: pendingDraggedEvent.start_time,
          end_time: pendingDraggedEvent.end_time,
          parent_group_event_id: pendingDraggedEvent.parent_group_event_id,
          is_group_event: pendingDraggedEvent.is_group_event,
        };
        // Pass the original event before drag, not the current event
        await onModifyThisOccurrence(originalEventBeforeDrag, modifiedData);
        setPendingDraggedEvent(null);
        setOriginalEventBeforeDrag(null);
      }
    },
    [pendingDraggedEvent, originalEventBeforeDrag, onModifyThisOccurrence],
  );

  const handleDragModifyThisAndFuture = useCallback(
    async (event: CalendarEvent) => {
      if (
        pendingDraggedEvent &&
        originalEventBeforeDrag &&
        onModifyThisAndFuture
      ) {
        const modifiedData = {
          title: pendingDraggedEvent.title,
          description: pendingDraggedEvent.description,
          location: pendingDraggedEvent.location,
          start_time: pendingDraggedEvent.start_time,
          end_time: pendingDraggedEvent.end_time,
          parent_group_event_id: pendingDraggedEvent.parent_group_event_id,
          is_group_event: pendingDraggedEvent.is_group_event,
        };
        // Pass the original event before drag, not the current event
        await onModifyThisAndFuture(originalEventBeforeDrag, modifiedData);
        setPendingDraggedEvent(null);
        setOriginalEventBeforeDrag(null);
      }
    },
    [pendingDraggedEvent, originalEventBeforeDrag, onModifyThisAndFuture],
  );

  const handleDragModifyAllInSeries = useCallback(
    async (event: CalendarEvent) => {
      if (
        pendingDraggedEvent &&
        originalEventBeforeDrag &&
        onModifyAllInSeries
      ) {
        const modifiedData = {
          title: pendingDraggedEvent.title,
          description: pendingDraggedEvent.description,
          location: pendingDraggedEvent.location,
          start_time: pendingDraggedEvent.start_time,
          end_time: pendingDraggedEvent.end_time,
          parent_group_event_id: pendingDraggedEvent.parent_group_event_id,
          is_group_event: pendingDraggedEvent.is_group_event,
        };
        // Pass the original event before drag, not the current event
        await onModifyAllInSeries(originalEventBeforeDrag, modifiedData);
        setPendingDraggedEvent(null);
        setOriginalEventBeforeDrag(null);
      }
    },
    [pendingDraggedEvent, originalEventBeforeDrag, onModifyAllInSeries],
  );

  const handleDragModificationConfirmed = () => {
    setPendingDraggedEvent(null);
    setOriginalEventBeforeDrag(null);
  };

  // Memoized handlers for JSX props to prevent unnecessary re-renders
  const openNewEventDialogHandler = useCallback(() => {
    openNewEventDialog();
  }, [openNewEventDialog]);

  const openNewEventDialogWithDayHandler = useCallback(
    (day: Date, isAllDay?: boolean) => {
      openNewEventDialog(day, isAllDay);
    },
    [openNewEventDialog],
  );

  // Handle today selection from mobile header
  const handleTodaySelected = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setShouldSelectToday(true);
    // Reset the flag after a brief delay to allow the effect to trigger
    setTimeout(() => setShouldSelectToday(false), 100);
  }, [setSelectedDate, setShouldSelectToday]);

  // Handle date selection from month overview
  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      // Navigate to the week containing the selected date
      const weekStart = startOfWeek(date, { weekStartsOn });
      setCurrentWeek(weekStart);
    },
    [setSelectedDate, setCurrentWeek, weekStartsOn],
  );

  // Handle month change from month overview
  const handleMonthChange = useCallback(
    (date: Date) => {
      // Navigate to the first week of the selected month
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const weekStart = startOfWeek(firstDayOfMonth, { weekStartsOn });
      setCurrentWeek(weekStart);
      setSelectedDate(firstDayOfMonth);
    },
    [setCurrentWeek, setSelectedDate, weekStartsOn],
  );

  // Handle event selection from search
  const handleEventSearchSelect = useCallback(
    (eventId: string, eventStartTime: Date) => {
      setSelectedDate(eventStartTime);
      const { navigateToEvent } = useCalendar.getState();
      navigateToEvent(eventId, eventStartTime, weekStartsOn);
    },
    [setSelectedDate, weekStartsOn],
  );

  return (
    <div className={`flex w-full h-full overflow-hidden ${className}`}>
      {/* Mobile Layout */}
      <div className="md:hidden w-full flex flex-col h-screen">
        {/* Mobile Header */}
        <div className="border-b p-4 flex-shrink-0">
          <CalendarHeaderMobile
            currentWeek={currentWeek}
            selectedDate={selectedDate}
            currentView={calendarView}
            setCurrentView={setCalendarView}
            setCurrentWeek={setCurrentWeek}
            openNewEventDialog={openNewEventDialogHandler}
            calendars={calendars}
            onCalendarToggle={onCalendarToggle}
            onCalendarCreate={onCalendarCreate}
            onICSCalendarCreate={onICSCalendarCreate}
            onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
            onCalendarEdit={onCalendarEdit}
            onCalendarDelete={handleCalendarDeleteWithEvents}
            onSetDefaultCalendar={onSetDefaultCalendar}
            onTodaySelected={handleTodaySelected}
            setSelectedDate={setSelectedDate}
          />
        </div>

        {/* Mobile Calendar Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Display loading or calendar grid */}
          {isLoading ? (
            <div className="text-center py-8">{loadingText}</div>
          ) : calendarView === "month" ? (
            <CalendarMonthGrid
              currentDate={selectedDate}
              selectedDate={selectedDate}
              events={eventsInCurrentMonth}
              calendars={calendarRenderData}
              openEditDialog={openEditDialog}
              onDateSelect={handleDateSelect}
            />
          ) : calendarView === "day" ? (
            <CalendarDayAgenda
              day={selectedDate}
              events={eventsInCurrentDay}
              calendars={calendarRenderData}
              openEditDialog={openEditDialog}
              openNewEventDialog={openNewEventDialogWithDayHandler}
              showFloatingAddButton
            />
          ) : (
            <CalendarGridMobile
              days={daysOfWeek}
              selectedDate={selectedDate}
              events={eventsInCurrentWeek}
              calendars={calendarRenderData}
              openEditDialog={openEditDialog}
              openNewEventDialog={openNewEventDialogWithDayHandler}
              onDateSelect={handleDateSelect}
              shouldSelectToday={shouldSelectToday}
            />
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full overflow-hidden">
        {/* Calendar Sidebar */}
        <CalendarSidebar
          calendars={calendars}
          onCalendarToggle={onCalendarToggle}
          onCalendarCreate={onCalendarCreate}
          onICSCalendarCreate={onICSCalendarCreate}
          onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
          onCalendarEdit={onCalendarEdit}
          onCalendarDelete={handleCalendarDeleteWithEvents}
          onSetDefaultCalendar={onSetDefaultCalendar}
          view={calendarView}
          selectedDate={selectedDate}
          currentWeek={currentWeek}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
        />

        {/* Main Calendar Content */}
        <div className="flex-1 flex flex-col px-4 overflow-hidden">
          <div className="flex-shrink-0">
            <CalendarHeader
              currentWeek={currentWeek}
              selectedDate={selectedDate}
              currentView={calendarView}
              setCurrentView={setCalendarView}
              setCurrentWeek={setCurrentWeek}
              openNewEventDialog={openNewEventDialogHandler}
              onTodaySelected={handleTodaySelected}
              setSelectedDate={setSelectedDate}
              events={allEvents}
              onEventSelect={handleEventSearchSelect}
            />

            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
                {error}
              </div>
            )}
          </div>

          {/* Display loading or calendar grid */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="text-center py-8">{loadingText}</div>
            ) : calendarView === "month" ? (
              <CalendarMonthGrid
                currentDate={selectedDate}
                selectedDate={selectedDate}
                events={eventsInCurrentMonth}
                calendars={calendarRenderData}
                openEditDialog={openEditDialog}
                onDateSelect={handleDateSelect}
              />
            ) : calendarView === "day" ? (
              <CalendarDayAgenda
                day={selectedDate}
                events={eventsInCurrentDay}
                calendars={calendarRenderData}
                openEditDialog={openEditDialog}
                openNewEventDialog={openNewEventDialogWithDayHandler}
              />
            ) : (
              <CalendarGrid
                days={daysOfWeek}
                events={eventsInCurrentWeek}
                calendars={calendarRenderData}
                openEditDialog={openEditDialog}
                openNewEventDialog={openNewEventDialogWithDayHandler}
                onEventUpdate={handleEventUpdateWithRecurrenceCheck}
                onTaskDrop={onTaskSchedule}
              />
            )}
          </div>
        </div>
      </div>

      {/* Event dialog */}
      <CalendarEventDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedEvent={selectedEvent}
        calendars={visibleCalendars}
        defaultCalendarId={defaultCalendarId}
        onSubmit={onSubmitEventHandler}
        onDelete={onDeleteEventHandler}
        onClone={onCloneEventHandler}
        onDeleteThisOccurrence={onDeleteThisOccurrenceHandler}
        onDeleteThisAndFuture={onDeleteThisAndFutureHandler}
        onDeleteAllInSeries={onDeleteAllInSeriesHandler}
        onModifyThisOccurrence={onModifyThisOccurrenceHandler}
        onModifyThisAndFuture={onModifyThisAndFutureHandler}
        onModifyAllInSeries={onModifyAllInSeriesHandler}
        linkedTaskTitle={
          selectedEvent?.task_id && tasks
            ? tasks.find((t) => t.id === selectedEvent.task_id)?.content
            : null
        }
        linkedTaskCompleted={
          selectedEvent?.task_id && tasks
            ? (tasks.find((t) => t.id === selectedEvent.task_id)?.completed ??
              null)
            : null
        }
        onNavigateToTask={
          selectedEvent?.task_id && onNavigateToTask
            ? () => {
                onNavigateToTask(selectedEvent.task_id!);
                setIsDialogOpen(false);
              }
            : undefined
        }
        projects={projects}
        onCreateTaskFromEvent={
          onCreateTaskFromEvent && selectedEvent
            ? (title, projectId) =>
                onCreateTaskFromEvent(selectedEvent.id, title, projectId)
            : undefined
        }
      />

      {/* Drag/Resize Modification Dialog */}
      {pendingDraggedEvent && (
        <RecurringEventModificationDialog
          isOpen={isDragModificationModalOpen}
          onOpenChange={setIsDragModificationModalOpen}
          selectedEvent={pendingDraggedEvent}
          onModifyThisOccurrence={handleDragModifyThisOccurrence}
          onModifyThisAndFuture={handleDragModifyThisAndFuture}
          onModifyAllInSeries={handleDragModifyAllInSeries}
          onModificationConfirmed={handleDragModificationConfirmed}
        />
      )}
    </div>
  );
}
