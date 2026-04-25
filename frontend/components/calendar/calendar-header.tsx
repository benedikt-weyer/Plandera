import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useTranslation, useDateLocale } from "@/utils/context/LanguageContext";
import { CalendarSearch } from "./calendar-search";
import { CalendarEvent, CalendarView } from "@/utils/calendar/calendar-types";
import { useWeekStartDay } from "@/stores/settings-store";

interface CalendarHeaderProps {
  currentWeek: Date;
  selectedDate: Date;
  currentView: CalendarView;
  setCurrentView: (view: CalendarView) => void;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  openNewEventDialog: () => void;
  onTodaySelected?: () => void;
  setSelectedDate?: React.Dispatch<React.SetStateAction<Date>>;
  events?: CalendarEvent[];
  onEventSelect?: (eventId: string, eventStartTime: Date) => void;
}

export function CalendarHeader({
  currentWeek,
  selectedDate,
  currentView,
  setCurrentView,
  setCurrentWeek,
  openNewEventDialog,
  onTodaySelected,
  setSelectedDate,
  events = [],
  onEventSelect,
}: CalendarHeaderProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const weekStartsOn = useWeekStartDay();
  const referenceDate =
    currentView === "month" ? startOfMonth(selectedDate) : currentWeek;

  const navigateToDate = (date: Date) => {
    const normalizedDate = currentView === "month" ? startOfMonth(date) : date;
    const weekStart = startOfWeek(normalizedDate, { weekStartsOn });
    setCurrentWeek(weekStart);
    setSelectedDate?.(normalizedDate);
  };

  const goToPreviousPeriod = () => {
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

  return (
    <div className="flex justify-between items-center my-2">
      <div className="flex items-center space-x-2">
        <div className="flex items-center border rounded-md overflow-hidden mr-4">
          <Button
            onClick={goToCurrentPeriod}
            size="sm"
            variant="outline"
            className="flex items-center gap-1 rounded-r-none border-0"
          >
            <Calendar className="h-4 w-4" />
            <span>{t("common.today")}</span>
          </Button>
          <div className="h-6 w-px bg-border my-auto"></div>
          <Button
            onClick={goToPreviousPeriod}
            size="sm"
            variant="outline"
            className="rounded-none border-0 px-2"
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
        <h2 className="text-lg font-medium">
          {currentView === "month"
            ? format(referenceDate, "MMMM yyyy", { locale: dateLocale })
            : `${format(currentWeek, "MMMM yyyy", { locale: dateLocale })} - Week ${format(currentWeek, "w", { locale: dateLocale })}`}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <ButtonGroup>
          <Button
            size="sm"
            variant={currentView === "week" ? "default" : "outline"}
            onClick={() => setCurrentView("week")}
          >
            {t("calendar.week")}
          </Button>
          <Button
            size="sm"
            variant={currentView === "month" ? "default" : "outline"}
            onClick={() => setCurrentView("month")}
          >
            {t("calendar.month")}
          </Button>
        </ButtonGroup>
        <CalendarSearch
          events={events}
          onEventSelect={(eventId, eventStartTime) =>
            onEventSelect?.(eventId, eventStartTime)
          }
          className="w-64"
        />
        <Button onClick={openNewEventDialog} size="sm">
          {t("calendar.addEvent")}
        </Button>
      </div>
    </div>
  );
}
