"use client";

import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMilliseconds,
} from "date-fns";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWeekStartDay } from "@/stores/settings-store";
import { useCalendar } from "@/stores/calendar-store";
import { useDateLocale, useTranslation } from "@/utils/context/LanguageContext";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import {
  getGroupChildrenForDay,
  getGroupEventStyle,
  isNestedGroupChild,
} from "@/utils/calendar/event-groups";

interface CalendarMonthGridProps {
  readonly currentDate: Date;
  readonly selectedDate: Date;
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
  /** Every visible event, not only the ones of this month; used to find a group's children. */
  readonly allEvents?: CalendarEvent[];
  readonly onAddEvent?: (date: Date) => void;
  readonly onNavigateToDate?: (date: Date) => void;
}

const MAX_VISIBLE_EVENTS = 3;

export function CalendarMonthGrid({
  currentDate,
  events,
  calendars,
  openEditDialog,
  onGroupClick,
  allEvents,
  onAddEvent,
  onNavigateToDate,
}: CalendarMonthGridProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const weekStartsOn = useWeekStartDay();
  const highlightedEventId = useCalendar((state) => state.highlightedEventId);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  // Events used to look up a group's children (also finds children outside of the visible range)
  const lookupEvents = allEvents ?? events;

  const { days, weekdayLabels, eventsByDay } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn });
    const daysInGrid = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    const labels = eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn }),
      end: endOfWeek(monthStart, { weekStartsOn }),
    }).map((day) => format(day, "EEE", { locale: dateLocale }));

    const groupedEvents = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      // Child events are shown with their group, not as separate chips (same as in the week view)
      if (isNestedGroupChild(event, lookupEvents)) {
        continue;
      }

      const eventStart = new Date(event.start_time);
      const eventEnd = subMilliseconds(new Date(event.end_time), 1);
      const clampedStart = eventStart < rangeStart ? rangeStart : eventStart;
      const clampedEnd = eventEnd > rangeEnd ? rangeEnd : eventEnd;

      if (clampedStart > clampedEnd) {
        continue;
      }

      const eventDays = eachDayOfInterval({
        start: startOfDay(clampedStart),
        end: startOfDay(clampedEnd),
      });

      for (const day of eventDays) {
        const key = format(day, "yyyy-MM-dd");
        const existing = groupedEvents.get(key) ?? [];
        existing.push(event);
        groupedEvents.set(key, existing);
      }
    }

    for (const [key, dayEvents] of groupedEvents.entries()) {
      dayEvents.sort((a, b) => {
        if (a.all_day && !b.all_day) return -1;
        if (!a.all_day && b.all_day) return 1;
        return (
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
      });
      groupedEvents.set(key, dayEvents);
    }

    return {
      days: daysInGrid,
      weekdayLabels: labels,
      eventsByDay: groupedEvents,
    };
  }, [currentDate, dateLocale, events, lookupEvents, weekStartsOn]);

  const getEventColor = (event: CalendarEvent) => {
    return (
      calendars?.find((calendar) => calendar.id === event.calendar_id)?.color ??
      "#3b82f6"
    );
  };

  const isEventHighlighted = (event: CalendarEvent) => {
    if (!highlightedEventId) return false;
    return (
      event.id === highlightedEventId ||
      event.id.startsWith(`${highlightedEventId}-recurrence-`) ||
      highlightedEventId.startsWith(`${event.id}-recurrence-`)
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenEventsCount = dayEvents.length - visibleEvents.length;
          const isCurrentMonth = isSameMonth(day, currentDate);
          return (
            <Popover
              key={dayKey}
              open={activeDayKey === dayKey}
              onOpenChange={(open) => setActiveDayKey(open ? dayKey : null)}
            >
              <PopoverTrigger asChild>
                <div
                  onClick={() =>
                    setActiveDayKey((current) =>
                      current === dayKey ? null : dayKey,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveDayKey((current) =>
                        current === dayKey ? null : dayKey,
                      );
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={[
                    "min-h-0 cursor-pointer border-b border-r p-2 text-left align-top transition-colors last:border-r-0",
                    isCurrentMonth
                      ? "bg-background"
                      : "bg-muted/25 text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={[
                        "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : "",
                      ].join(" ")}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {visibleEvents.map((event) => {
                      const isGroup = Boolean(event.is_group_event);
                      const isTaskReservationSpace = Boolean(
                        event.is_task_reservation_space,
                      );
                      const color = getEventColor(event);
                      const childCount = isGroup
                        ? getGroupChildrenForDay(event, lookupEvents, day)
                            .length
                        : 0;
                      const showTime =
                        !event.all_day &&
                        isSameDay(new Date(event.start_time), day);
                      const handleOpen = () => {
                        setActiveDayKey(null);
                        if (isGroup && onGroupClick) {
                          onGroupClick(event);
                        } else {
                          openEditDialog(event);
                        }
                      };

                      return (
                        <div
                          key={`${event.id}-${dayKey}`}
                          role="button"
                          tabIndex={0}
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            handleOpen();
                          }}
                          onKeyDown={(eventKey) => {
                            if (
                              eventKey.key === "Enter" ||
                              eventKey.key === " "
                            ) {
                              eventKey.preventDefault();
                              handleOpen();
                            }
                          }}
                          className={[
                            "flex h-6 items-center gap-1 rounded px-2 text-xs font-medium",
                            isGroup
                              ? "text-gray-900 dark:text-gray-100"
                              : "text-white",
                            "truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            isEventHighlighted(event)
                              ? "ring-2 ring-primary ring-offset-1"
                              : "",
                          ].join(" ")}
                          style={
                            isGroup
                              ? getGroupEventStyle(color, isTaskReservationSpace)
                              : { backgroundColor: color }
                          }
                        >
                          {isGroup && (
                            <span
                              className="inline-flex shrink-0 items-center"
                              style={{ color }}
                            >
                              {isTaskReservationSpace ? (
                                <CalendarClock className="h-3 w-3" />
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="12"
                                  height="12"
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
                          )}
                          {showTime && (
                            <span
                              className={
                                isGroup
                                  ? "shrink-0 text-[10px] font-semibold opacity-70"
                                  : "shrink-0 text-[10px] font-semibold text-white/85"
                              }
                            >
                              {format(new Date(event.start_time), "HH:mm")}
                            </span>
                          )}
                          <span className="truncate">{event.title}</span>
                          {childCount > 0 && (
                            <span
                              className="ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: color }}
                              title={`${childCount} ${childCount === 1 ? "event" : "events"} in this group`}
                            >
                              {childCount}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {hiddenEventsCount > 0 && (
                      <div className="px-1 text-xs font-medium text-muted-foreground">
                        +{hiddenEventsCount} more
                      </div>
                    )}
                  </div>
                </div>
              </PopoverTrigger>

              <PopoverContent className="w-56 p-3" align="center">
                <div className="mb-3">
                  <div className="text-sm font-semibold">
                    {format(day, "EEEE, MMMM d", { locale: dateLocale })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("calendar.chooseDayAction")}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveDayKey(null);
                      onAddEvent?.(day);
                    }}
                  >
                    {t("calendar.addEvent")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveDayKey(null);
                      onNavigateToDate?.(day);
                    }}
                  >
                    {t("calendar.goToDay")}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
