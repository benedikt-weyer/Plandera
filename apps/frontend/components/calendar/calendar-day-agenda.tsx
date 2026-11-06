"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { differenceInMinutes, format, isSameDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import {
  getGroupChildrenForDay,
  getGroupEventStyle,
  isNestedGroupChild,
} from "@/utils/calendar/event-groups";
import { getRecurrencePattern } from "@/utils/calendar/eventDataProcessing";
import { calculateEventLayout } from "@/utils/calendar/calendar-render";

interface CalendarDayAgendaProps {
  readonly className?: string;
  readonly day: Date;
  readonly events: CalendarEvent[];
  readonly calendars?: {
    id: string;
    color: string;
    name: string;
    isVisible: boolean;
  }[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  /** Called instead of `openEditDialog` when a group event is clicked (shows the group with its children). */
  readonly onGroupClick?: (event: CalendarEvent) => void;
  /** Every visible event, not only the ones of this day; used to find a group's children. */
  readonly allEvents?: CalendarEvent[];
  readonly openNewEventDialog: (day: Date, isAllDay?: boolean) => void;
  readonly showFloatingAddButton?: boolean;
  readonly floatingAddButtonClassName?: string;
}

export function CalendarDayAgenda({
  className,
  day,
  events,
  calendars,
  openEditDialog,
  onGroupClick,
  allEvents,
  openNewEventDialog,
  showFloatingAddButton = false,
  floatingAddButtonClassName = "fixed bottom-6 right-6 md:hidden",
}: CalendarDayAgendaProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const timeSlots = useMemo(
    () =>
      Array.from(
        { length: 24 },
        (_, hour) => `${hour.toString().padStart(2, "0")}:00`,
      ),
    [],
  );

  // Events used to look up a group's children (also finds children outside of the current day)
  const lookupEvents = allEvents ?? events;

  // Child events are shown inside their group, not as separate events (same as in the week view)
  const dayEvents = useMemo(() => {
    return events.filter(
      (event) =>
        (isSameDay(new Date(event.start_time), day) ||
          isSameDay(new Date(event.end_time), day)) &&
        !isNestedGroupChild(event, lookupEvents),
    );
  }, [day, events, lookupEvents]);

  const allDayEvents = dayEvents.filter((event) => event.all_day);
  const timedEvents = dayEvents.filter((event) => !event.all_day);

  const getEventColor = (event: CalendarEvent) => {
    const calendar = calendars?.find(
      (calendar) => calendar.id === event.calendar_id,
    );
    return calendar?.color || "#4f46e5";
  };

  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);

    const startMinutesFromMidnight = differenceInMinutes(eventStart, dayStart);
    const topPercent = Math.max(
      0,
      (startMinutesFromMidnight / (24 * 60)) * 100,
    );

    const durationMinutes = differenceInMinutes(eventEnd, eventStart);
    const heightPercent = (durationMinutes / (24 * 60)) * 100;

    return {
      top: `${topPercent}%`,
      height: `${Math.max(heightPercent, 2)}%`,
    };
  };

  const calculateCurrentTimePosition = (): number | null => {
    if (!isSameDay(currentTime, day)) return null;

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);

    const minutesSinceMidnight = differenceInMinutes(currentTime, dayStart);
    const positionPercent = (minutesSinceMidnight / (24 * 60)) * 100;

    return Math.max(0, Math.min(100, positionPercent));
  };

  const renderCurrentTimeLine = () => {
    const positionPercent = calculateCurrentTimePosition();

    if (positionPercent === null) return null;

    return (
      <div
        className="absolute w-full h-[2px] -translate-y-1/2 pointer-events-none z-30 bg-red-500"
        style={{
          top: `${positionPercent}%`,
        }}
      >
        <div className="absolute left-0 w-2 h-2 -translate-x-full -translate-y-1/2 rounded-full bg-red-500" />
      </div>
    );
  };

  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent) => {
    const start1 = new Date(event1.start_time);
    const end1 = new Date(event1.end_time);
    const start2 = new Date(event2.start_time);
    const end2 = new Date(event2.end_time);

    return start1 < end2 && start2 < end1;
  };

  const groupOverlappingEvents = (inputEvents: CalendarEvent[]) => {
    const groups: CalendarEvent[][] = [];
    const processed = new Set<string>();

    for (const event of inputEvents) {
      if (processed.has(event.id)) continue;

      const group = [event];
      processed.add(event.id);

      let hasNewOverlap = true;
      while (hasNewOverlap) {
        hasNewOverlap = false;
        for (const otherEvent of inputEvents) {
          if (processed.has(otherEvent.id)) continue;

          const overlapsWithGroup = group.some((groupEvent) =>
            eventsOverlap(groupEvent, otherEvent),
          );
          if (overlapsWithGroup) {
            group.push(otherEvent);
            processed.add(otherEvent.id);
            hasNewOverlap = true;
          }
        }
      }

      groups.push(group);
    }

    return groups;
  };

  const renderGroupEvent = (
    event: CalendarEvent,
    positionStyle: CSSProperties,
    className: string,
  ) => {
    const color = getEventColor(event);
    const isTaskReservationSpace = Boolean(event.is_task_reservation_space);
    const groupStart = new Date(event.start_time);
    const groupEnd = new Date(event.end_time);
    const groupDuration = differenceInMinutes(groupEnd, groupStart);
    const childEvents =
      groupDuration > 0 ? getGroupChildrenForDay(event, lookupEvents, day) : [];

    return (
      <div
        key={event.id}
        data-event-id={event.id}
        role="button"
        className={`group pointer-events-auto absolute cursor-pointer overflow-hidden rounded-md p-2 text-xs shadow-sm backdrop-blur-sm ${className}`}
        style={{
          ...positionStyle,
          minHeight: "2rem",
          ...getGroupEventStyle(color, isTaskReservationSpace),
        }}
        onClick={() => (onGroupClick ?? openEditDialog)(event)}
      >
        <div className="relative z-10 -mx-2 -mt-2 bg-white/80 px-2 pb-1 pt-2 transition-colors group-hover:bg-white/10 dark:bg-gray-900/80 dark:group-hover:bg-gray-900/10">
          <div className="flex items-center gap-1 truncate font-medium text-gray-900 transition-opacity group-hover:opacity-10 dark:text-gray-100">
            <span
              className="inline-flex flex-shrink-0 items-center"
              style={{ color }}
            >
              {isTaskReservationSpace ? (
                <CalendarClock className="h-3.5 w-3.5" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              )}
            </span>
            <span className="truncate">{event.title}</span>
          </div>
          <div className="truncate text-xs text-gray-700 transition-opacity group-hover:opacity-10 dark:text-gray-300">
            {format(groupStart, "HH:mm")} - {format(groupEnd, "HH:mm")}
          </div>
        </div>
        {event.location && (
          <div className="relative z-10 truncate text-xs text-gray-700 dark:text-gray-300">
            📍 {event.location}
          </div>
        )}

        {childEvents.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-0">
            {childEvents.map((childEvent) => {
              const childStart = new Date(childEvent.start_time);
              const childEnd = new Date(childEvent.end_time);
              const childDuration = differenceInMinutes(childEnd, childStart);
              const minutesFromGroupStart = differenceInMinutes(
                childStart,
                groupStart,
              );
              const topPercent = Math.max(
                0,
                (minutesFromGroupStart / groupDuration) * 100,
              );
              const heightPercent = Math.min(
                100 - topPercent,
                (childDuration / groupDuration) * 100,
              );

              return (
                <div
                  key={childEvent.id}
                  className="absolute left-1 right-1 overflow-hidden rounded-sm px-1 text-xs text-white shadow-sm"
                  style={{
                    top: `${topPercent}%`,
                    height: `${heightPercent}%`,
                    minHeight: "16px",
                    backgroundColor: getEventColor(childEvent),
                  }}
                  title={`${childEvent.title} (${format(childStart, "HH:mm")} - ${format(childEnd, "HH:mm")})`}
                >
                  <div className="truncate text-[10px] font-medium">
                    {childEvent.title}
                  </div>
                  {heightPercent > 15 && (
                    <div className="truncate text-[9px] opacity-80">
                      {format(childStart, "HH:mm")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTimedEvent = (
    event: CalendarEvent,
    positionStyle: CSSProperties,
    className: string,
  ) => {
    if (event.is_group_event) {
      return renderGroupEvent(event, positionStyle, className);
    }

    const color = getEventColor(event);

    return (
      <div
        key={event.id}
        className={`pointer-events-auto absolute rounded-md border-l-4 p-2 text-xs shadow-sm ${className}`}
        style={{
          ...positionStyle,
          backgroundColor: color,
          borderLeftColor: color,
          minHeight: "2rem",
        }}
        onClick={() => openEditDialog(event)}
      >
        <div className="line-clamp-1 font-medium text-white">{event.title}</div>
        <div className="text-xs text-white opacity-90">
          {format(new Date(event.start_time), "HH:mm")} -{" "}
          {format(new Date(event.end_time), "HH:mm")}
        </div>
        {event.location && (
          <div className="mt-1 line-clamp-1 text-xs text-white opacity-90">
            📍 {event.location}
          </div>
        )}
        {event.description && (
          <div className="mt-1 line-clamp-1 text-xs text-white opacity-90">
            {event.description}
          </div>
        )}
      </div>
    );
  };

  const handleTimeSlotClick = (timeSlot: string) => {
    const [hour] = timeSlot.split(":").map(Number);
    const clickTime = new Date(day);
    clickTime.setHours(hour, 0, 0, 0);
    openNewEventDialog(clickTime, false);
  };

  const handleAllDayClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-event-id]")) {
      return;
    }

    const allDayDate = new Date(day);
    allDayDate.setHours(0, 0, 0, 0);
    openNewEventDialog(allDayDate, true);
  };

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      <div
        className="mb-4 rounded-lg bg-muted/30 p-3 cursor-pointer"
        onClick={handleAllDayClick}
      >
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          All Day
        </div>
        {allDayEvents.length > 0 ? (
          <div className="space-y-2">
            {allDayEvents.map((event) => {
              const color = getEventColor(event);
              const recurrencePattern = getRecurrencePattern(event);
              const isRecurring = !!recurrencePattern;
              const isRecurrenceInstance = event.id.includes("-recurrence-");

              return (
                <div
                  key={event.id}
                  className="cursor-pointer rounded px-3 py-2 text-xs"
                  style={{
                    backgroundColor: color,
                    color: "white",
                  }}
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    openEditDialog(event);
                  }}
                  data-event-id={event.id}
                >
                  <div className="flex items-center gap-1 font-medium">
                    {isRecurring || isRecurrenceInstance ? (
                      <span className="inline-flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
                          <path d="M12 7v5l2.5 2.5"></path>
                        </svg>
                      </span>
                    ) : null}
                    {event.title}
                  </div>
                  {event.location && (
                    <div className="mt-1 text-xs opacity-90">
                      📍 {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="mt-1 line-clamp-2 text-xs opacity-90">
                      {event.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs italic text-muted-foreground">
            Tap to add all-day event
          </div>
        )}
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="relative">
          {timeSlots.map((timeSlot) => (
            <div
              key={timeSlot}
              className="relative flex h-16 items-start border-b border-border"
              onClick={() => handleTimeSlotClick(timeSlot)}
            >
              <div className="w-16 pt-1 pr-2 text-right text-xs text-muted-foreground">
                {timeSlot}
              </div>
              <div className="h-full flex-1 cursor-pointer" />
            </div>
          ))}

          <div className="pointer-events-none absolute inset-0 ml-16">
            {renderCurrentTimeLine()}

            {groupOverlappingEvents(timedEvents).flatMap((group) => {
              if (group.length === 1) {
                const event = group[0];
                return renderTimedEvent(
                  event,
                  getEventStyle(event),
                  "left-1 right-1",
                );
              }

              const layouts = calculateEventLayout(group);
              return layouts.map((layout) => {
                const columnWidth = 100 / layout.totalColumns;
                const width = columnWidth * layout.columnSpan;
                const left = columnWidth * layout.column;

                return renderTimedEvent(
                  layout.event,
                  {
                    ...getEventStyle(layout.event),
                    width: `calc(${width}% - 4px)`,
                    left: `calc(${left}% + 4px)`,
                  },
                  "",
                );
              });
            })}
          </div>
        </div>
      </div>

      {showFloatingAddButton && (
        <div className={floatingAddButtonClassName}>
          <Button
            className="flex h-14 w-14 min-w-0 items-center justify-center rounded-full p-0 shadow-lg"
            onClick={() => openNewEventDialog(day, false)}
          >
            <span className="text-2xl">+</span>
          </Button>
        </div>
      )}
    </div>
  );
}
