"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar as CalendarType,
  CalendarView,
} from "@/utils/calendar/calendar-types";
import { useDateLocale, useTranslation } from "@/utils/context/LanguageContext";
import { useWeekStartDay } from "@/stores/settings-store";

interface CalendarHeaderMobileProps {
  currentWeek: Date;
  selectedDate: Date;
  currentView: CalendarView;
  setCurrentView: (view: CalendarView) => void;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  openNewEventDialog: () => void;
  calendars: CalendarType[];
  onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  onCalendarCreate: (name: string, color: string) => void;
  onICSCalendarCreate: (name: string, color: string, icsUrl: string) => void;
  onICSCalendarRefresh: (calendarId: string) => void;
  onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  onCalendarDelete: (calendarId: string) => void;
  onSetDefaultCalendar: (calendarId: string) => void;
  onTodaySelected?: () => void;
  setSelectedDate?: React.Dispatch<React.SetStateAction<Date>>;
}

export function CalendarHeaderMobile({
  currentWeek,
  selectedDate,
  currentView,
  setCurrentView,
  setCurrentWeek,
  openNewEventDialog,
  calendars,
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,
  onTodaySelected,
  setSelectedDate,
}: CalendarHeaderMobileProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const weekStartsOn = useWeekStartDay();
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);
  const referenceDate =
    currentView === "month"
      ? startOfMonth(selectedDate)
      : currentView === "day"
        ? selectedDate
        : currentWeek;

  const navigateToDate = (date: Date) => {
    const normalizedDate = currentView === "month" ? startOfMonth(date) : date;
    const weekStart = startOfWeek(normalizedDate, { weekStartsOn });
    setCurrentWeek(weekStart);
    setSelectedDate?.(normalizedDate);
  };

  const goToPreviousPeriod = () => {
    if (currentView === "day") {
      navigateToDate(subDays(referenceDate, 1));
      return;
    }

    if (currentView === "month") {
      navigateToDate(subMonths(referenceDate, 1));
      return;
    }

    setCurrentWeek((prevWeek) => {
      const newWeek = subWeeks(prevWeek, 1);
      setSelectedDate?.(newWeek);
      return newWeek;
    });
  };

  const goToNextPeriod = () => {
    if (currentView === "day") {
      navigateToDate(addDays(referenceDate, 1));
      return;
    }

    if (currentView === "month") {
      navigateToDate(addMonths(referenceDate, 1));
      return;
    }

    setCurrentWeek((prevWeek) => {
      const newWeek = addWeeks(prevWeek, 1);
      setSelectedDate?.(newWeek);
      return newWeek;
    });
  };

  const goToCurrentPeriod = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn });
    setCurrentWeek(weekStart);
    setSelectedDate?.(today);
    onTodaySelected?.();
  };

  const handleCalendarCreate = () => {
    // For mobile, we'll use a simple prompt for now
    const name = prompt("Calendar name:");
    if (name?.trim()) {
      onCalendarCreate(name.trim(), "#4f46e5");
    }
    setIsCalendarMenuOpen(false);
  };

  const handleCalendarToggle = (
    calendarId: string,
    currentVisibility: boolean,
  ) => {
    onCalendarToggle(calendarId, !currentVisibility);
  };

  const visibleCalendarsCount = calendars.filter(
    (cal) => cal.is_visible,
  ).length;

  return (
    <div className="space-y-3">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={goToCurrentPeriod}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            {t("common.today")}
          </Button>
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              onClick={goToPreviousPeriod}
              size="sm"
              variant="outline"
              className="rounded-r-none border-0 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              onClick={goToNextPeriod}
              size="sm"
              variant="outline"
              className="rounded-l-none border-0 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button onClick={openNewEventDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("calendar.addEvent")}
        </Button>
      </div>

      {/* Month/Week Info and Calendar Settings */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {currentView === "month"
            ? format(referenceDate, "MMM yyyy", { locale: dateLocale })
            : currentView === "day"
              ? format(referenceDate, "EEE, MMM d", { locale: dateLocale })
              : `${format(currentWeek, "MMM yyyy", { locale: dateLocale })} - Week ${format(currentWeek, "w", { locale: dateLocale })}`}
        </h2>

        {/* Calendar Settings Dropdown */}
        <DropdownMenu
          open={isCalendarMenuOpen}
          onOpenChange={setIsCalendarMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="text-xs">
                {visibleCalendarsCount} of {calendars.length}
              </span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5 text-sm font-medium">Calendars</div>
            <DropdownMenuSeparator />

            {/* Calendar List */}
            {calendars.map((calendar) => (
              <DropdownMenuItem
                key={calendar.id}
                onClick={() =>
                  handleCalendarToggle(calendar.id, calendar.is_visible)
                }
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full border-2`}
                    style={{
                      borderColor: calendar.color,
                      backgroundColor: calendar.is_visible
                        ? calendar.color
                        : "transparent",
                    }}
                  />
                  <span
                    className={
                      calendar.is_visible
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {calendar.name}
                  </span>
                  {calendar.is_default && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-1 rounded">
                      Default
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Add Calendar */}
            <DropdownMenuItem onClick={handleCalendarCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Calendar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ButtonGroup className="w-full">
        <Button
          size="sm"
          className="flex-1"
          variant={currentView === "day" ? "default" : "outline"}
          onClick={() => setCurrentView("day")}
        >
          {t("calendar.day")}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          variant={currentView === "week" ? "default" : "outline"}
          onClick={() => setCurrentView("week")}
        >
          {t("calendar.week")}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          variant={currentView === "month" ? "default" : "outline"}
          onClick={() => setCurrentView("month")}
        >
          {t("calendar.month")}
        </Button>
      </ButtonGroup>
    </div>
  );
}
