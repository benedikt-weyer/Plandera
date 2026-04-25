"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimeInput } from "@/components/ui/time-input";
import {
  formatDurationInput,
  parseDurationInput,
} from "@/utils/can-do-list/duration-input-parser";
import { useTranslation } from "@/utils/context/LanguageContext";

export const DURATION_PRESETS = [
  5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 480,
] as const;

interface DurationPresetPickerProps {
  readonly disabled?: boolean;
  readonly selectedDuration?: number;
  readonly onSelectDuration: (minutes: number) => void;
  readonly onClearDuration?: () => void;
}

export function DurationPresetPicker({
  disabled = false,
  selectedDuration,
  onSelectDuration,
  onClearDuration,
}: DurationPresetPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState("");
  const [timePickerValue, setTimePickerValue] = useState("00:00");

  useEffect(() => {
    if (!open) return;

    const formattedDuration = formatDurationInput(selectedDuration);
    setCustomDurationInput(formattedDuration);

    const totalMinutes = selectedDuration ?? 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setTimePickerValue(
      `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
    );
  }, [open, selectedDuration]);

  const parsedCustomDuration = useMemo(
    () => parseDurationInput(customDurationInput),
    [customDurationInput],
  );

  const applyCustomDuration = () => {
    if (
      !parsedCustomDuration.isValid ||
      parsedCustomDuration.minutes === null
    ) {
      return;
    }

    if (parsedCustomDuration.minutes === 0) {
      onClearDuration?.();
      setOpen(false);
      return;
    }

    onSelectDuration(parsedCustomDuration.minutes);
    setOpen(false);
  };

  const applyTimePickerDuration = () => {
    const [hours, minutes] = timePickerValue.split(":").map(Number);
    const totalMinutes =
      (Number.isNaN(hours) ? 0 : hours) * 60 +
      (Number.isNaN(minutes) ? 0 : minutes);

    if (totalMinutes === 0) {
      onClearDuration?.();
      setOpen(false);
      return;
    }

    onSelectDuration(totalMinutes);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          title={t("tasks.estimatedDuration")}
          className="shrink-0 p-2 text-muted-foreground hover:text-foreground"
        >
          <Clock3 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {t("tasks.estimatedDuration")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("tasks.quickDurationHelp")}
            </div>
          </div>
          {selectedDuration && onClearDuration ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                onClearDuration();
                setOpen(false);
              }}
              title={t("tasks.clearDuration")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {DURATION_PRESETS.map((minutes) => (
            <Button
              key={minutes}
              type="button"
              variant={selectedDuration === minutes ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                onSelectDuration(minutes);
                setOpen(false);
              }}
            >
              {formatDurationInput(minutes)}
            </Button>
          ))}
        </div>
        <div className="mt-4 space-y-3 border-t pt-3">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("tasks.customDuration")}
            </div>
            <div className="flex items-start gap-2">
              <Input
                value={customDurationInput}
                onChange={(event) => setCustomDurationInput(event.target.value)}
                placeholder="2h 30m"
                disabled={disabled}
              />
              <Button
                type="button"
                size="sm"
                disabled={
                  disabled ||
                  !parsedCustomDuration.isValid ||
                  parsedCustomDuration.minutes === null
                }
                onClick={applyCustomDuration}
              >
                {t("common.save")}
              </Button>
            </div>
            {customDurationInput && !parsedCustomDuration.isValid ? (
              <div className="text-xs text-destructive">
                {parsedCustomDuration.error}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("tasks.durationTimePicker")}
            </div>
            <div className="flex items-start gap-2">
              <TimeInput
                value={timePickerValue}
                onChange={setTimePickerValue}
                disabled={disabled}
                quickTimeOptions={[
                  { value: "00:15", label: "15m" },
                  { value: "00:30", label: "30m" },
                  { value: "01:00", label: "1h" },
                  { value: "01:30", label: "1h 30m" },
                  { value: "02:00", label: "2h" },
                  { value: "03:00", label: "3h" },
                ]}
              />
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={applyTimePickerDuration}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
