"use client";

import { useEffect, useState } from "react";
import {
  addYears,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  subYears,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDateLocale } from "@/utils/context/LanguageContext";

interface MonthPickerProps {
  readonly selectedDate?: Date;
  readonly onMonthSelect?: (date: Date) => void;
}

export function MonthPicker({
  selectedDate = new Date(),
  onMonthSelect,
}: MonthPickerProps) {
  const dateLocale = useDateLocale();
  const [currentYear, setCurrentYear] = useState<Date>(selectedDate);

  useEffect(() => {
    if (!isSameYear(currentYear, selectedDate)) {
      setCurrentYear(selectedDate);
    }
  }, [currentYear, selectedDate]);

  const months = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(currentYear.getFullYear(), index, 1);
    return {
      label: format(monthDate, "MMM", { locale: dateLocale }),
      value: monthDate,
    };
  });

  return (
    <div className="w-full border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-accent"
          onClick={() => setCurrentYear((prev) => subYears(prev, 1))}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>

        <div className="text-sm font-semibold">
          {format(currentYear, "yyyy", { locale: dateLocale })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-accent"
          onClick={() => setCurrentYear((prev) => addYears(prev, 1))}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {months.map((month) => {
          const isSelected = isSameMonth(month.value, selectedDate);

          return (
            <Button
              key={month.label}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => onMonthSelect?.(startOfMonth(month.value))}
            >
              {month.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
