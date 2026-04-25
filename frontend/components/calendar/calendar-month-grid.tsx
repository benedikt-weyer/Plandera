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
  readonly onAddEvent?: (date: Date) => void;
  readonly onNavigateToDate?: (date: Date) => void;
}

const MAX_VISIBLE_EVENTS = 3;

export function CalendarMonthGrid({
  currentDate,
  events,
  calendars,
  openEditDialog,
  onAddEvent,
  onNavigateToDate,
}: CalendarMonthGridProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const weekStartsOn = useWeekStartDay();
  const highlightedEventId = useCalendar((state) => state.highlightedEventId);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

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
  }, [currentDate, dateLocale, events, weekStartsOn]);

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
                      const showTime =
                        !event.all_day &&
                        isSameDay(new Date(event.start_time), day);

                      return (
                        <div
                          key={`${event.id}-${dayKey}`}
                          role="button"
                          tabIndex={0}
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            setActiveDayKey(null);
                            openEditDialog(event);
                          }}
                          onKeyDown={(eventKey) => {
                            if (
                              eventKey.key === "Enter" ||
                              eventKey.key === " "
                            ) {
                              eventKey.preventDefault();
                              setActiveDayKey(null);
                              openEditDialog(event);
                            }
                          }}
                          className={[
                            "flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-white",
                            "truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            isEventHighlighted(event)
                              ? "ring-2 ring-primary ring-offset-1"
                              : "",
                          ].join(" ")}
                          style={{ backgroundColor: getEventColor(event) }}
                        >
                          {showTime && (
                            <span className="shrink-0 text-[10px] font-semibold text-white/85">
                              {format(new Date(event.start_time), "HH:mm")}
                            </span>
                          )}
                          <span className="truncate">{event.title}</span>
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
