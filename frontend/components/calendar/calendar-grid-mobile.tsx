"use client";

import { useEffect, useMemo, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { useDateLocale } from "@/utils/context/LanguageContext";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import { CalendarDayAgenda } from "./calendar-day-agenda";

interface CalendarGridMobileProps {
  readonly days: Date[];
  readonly selectedDate: Date;
  readonly events: CalendarEvent[];
  readonly calendars?: {
    id: string;
    color: string;
    name: string;
    isVisible: boolean;
  }[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date, isAllDay?: boolean) => void;
  readonly onDateSelect?: (date: Date) => void;
  readonly shouldSelectToday?: boolean;
}

export function CalendarGridMobile({
  days,
  selectedDate,
  events,
  calendars,
  openEditDialog,
  openNewEventDialog,
  onDateSelect,
  shouldSelectToday = false,
}: CalendarGridMobileProps) {
  const dateLocale = useDateLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldSelectToday) return;

    const today = new Date();
    const todayInWeek = days.find((day) => isSameDay(day, today));
    if (todayInWeek) {
      onDateSelect?.(todayInWeek);
    }
  }, [days, onDateSelect, shouldSelectToday]);

  const selectedDay = useMemo(() => {
    return days.find((day) => isSameDay(day, selectedDate)) ?? days[0];
  }, [days, selectedDate]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="mb-4 flex flex-shrink-0 gap-1 overflow-x-auto pb-2"
        ref={scrollRef}
      >
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toString()}
              onClick={() => onDateSelect?.(day)}
              className={`relative flex h-16 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 text-xs ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {isToday && (
                <div
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full ${
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
              )}

              <div className="font-medium">
                {format(day, "EEE", { locale: dateLocale })}
              </div>
              <div
                className={`text-lg font-bold ${
                  isSelected
                    ? isToday
                      ? "font-extrabold text-primary-foreground"
                      : "text-primary-foreground"
                    : isToday
                      ? "text-primary"
                      : ""
                }`}
              >
                {format(day, "d")}
              </div>
              {isToday && (
                <div className="mt-1 h-1 w-1 rounded-full bg-current" />
              )}
            </button>
          );
        })}
      </div>

      <CalendarDayAgenda
        day={selectedDay}
        events={events}
        calendars={calendars}
        openEditDialog={openEditDialog}
        openNewEventDialog={openNewEventDialog}
        showFloatingAddButton
        className="min-h-0 flex-1"
      />
    </div>
  );
}
