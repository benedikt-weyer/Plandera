"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/shadcn-utils";

export type QuickTimeOption = {
  value: string;
  label?: string;
};

export interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onChange?: (value: string) => void;
  quickTimeOptions?: QuickTimeOption[];
}

const TimeInput = React.forwardRef<HTMLDivElement, TimeInputProps>(
  ({ className, value, onChange, disabled, quickTimeOptions, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value || "");
    const timePickerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Parse time string into hours and minutes
    const parseTime = (timeStr: string): { hours: number; minutes: number } => {
      if (!timeStr) {
        return { hours: 0, minutes: 0 };
      }
      const [hours, minutes] = timeStr.split(":").map(Number);
      return {
        hours: Number.isNaN(hours) ? 0 : hours,
        minutes: Number.isNaN(minutes) ? 0 : minutes
      };
    };

    // Format hours and minutes into time string (HH:MM)
    const formatTime = (hours: number, minutes: number): string => {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };

    const { hours, minutes } = parseTime(internalValue as string);

    // Handle manual input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    // Update hours
    const updateHours = (newHours: number) => {
      // Ensure hours are between 0-23
      const validHours = Math.max(0, Math.min(23, newHours));
      const newTime = formatTime(validHours, minutes);
      setInternalValue(newTime);
      onChange?.(newTime);
    };

    // Update minutes
    const updateMinutes = (newMinutes: number) => {
      // Ensure minutes are between 0-59
      const validMinutes = Math.max(0, Math.min(59, newMinutes));
      const newTime = formatTime(hours, validMinutes);
      setInternalValue(newTime);
      onChange?.(newTime);
    };

    // Close the dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          timePickerRef.current &&
          !timePickerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    // Synchronize with external value changes
    React.useEffect(() => {
      if (value !== undefined && value !== internalValue) {
        setInternalValue(value);
      }
    }, [value]);

    // Handle keyboard events for the input
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.shiftKey) {
          updateHours(hours + 1);
        } else {
          updateMinutes(minutes + 5);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.shiftKey) {
          updateHours(hours - 1);
        } else {
          updateMinutes(minutes - 5);
        }
      } else if (e.key === "Enter") {
        setIsOpen(!isOpen);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    // Parse manually typed input
    const handleBlur = () => {
      const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timePattern.test(internalValue as string)) {
        // If the input doesn't match the pattern, reset to the previous valid time
        if (value) {
          setInternalValue(value);
        } else {
          setInternalValue("00:00");
        }
      }
    };

    // Default quick time options if none provided
    const defaultQuickTimeOptions: QuickTimeOption[] = [
      { value: "09:00" },
      { value: "12:00"},
      { value: "15:00" },
      { value: "18:00" }
    ];

    const timeOptions = quickTimeOptions || defaultQuickTimeOptions;

    return (
      <div 
        ref={timePickerRef}
        className={cn("relative", className)}
      >
        <div className="flex items-center relative">
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "pr-10"
            )}
            placeholder="HH:MM"
            value={internalValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={disabled}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
          >
            <Clock className="h-4 w-4" />
          </Button>
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-input bg-background shadow-md">
            <div className="grid grid-cols-2 p-2 gap-2">
              {/* Hours Column */}
              <div className="flex flex-col items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => updateHours(hours + 1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="text-center py-1 font-medium">
                  {hours.toString().padStart(2, "0")}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => updateHours(hours - 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Minutes Column */}
              <div className="flex flex-col items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => updateMinutes(minutes + 5)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="text-center py-1 font-medium">
                  {minutes.toString().padStart(2, "0")}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => updateMinutes(minutes - 5)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick time selections */}
            {timeOptions.length > 0 && (
              <div className="grid grid-cols-2 gap-1 p-2 border-t">
                {timeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setInternalValue(option.value);
                      onChange?.(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.value}{option.label ? ` (${option.label})` : ''}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

TimeInput.displayName = "TimeInput";

export { TimeInput };