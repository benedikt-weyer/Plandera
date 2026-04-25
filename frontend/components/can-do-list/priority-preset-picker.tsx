"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { calculatePriority } from "@/utils/can-do-list/priority-utils";
import { useTranslation } from "@/utils/context/LanguageContext";

const PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface PriorityPresetPickerProps {
  readonly disabled?: boolean;
  readonly impact?: number;
  readonly urgency?: number;
  readonly onSelectPriority: (impact?: number, urgency?: number) => void;
  readonly onClearPriority?: () => void;
}

export function PriorityPresetPicker({
  disabled = false,
  impact,
  urgency,
  onSelectPriority,
  onClearPriority,
}: PriorityPresetPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [separateMode, setSeparateMode] = useState(
    (impact !== undefined || urgency !== undefined) &&
      (impact === undefined || urgency === undefined || impact !== urgency),
  );
  const [tempImpact, setTempImpact] = useState<number | undefined>(
    impact ?? urgency ?? undefined,
  );
  const [tempUrgency, setTempUrgency] = useState<number | undefined>(
    urgency ?? impact ?? undefined,
  );

  useEffect(() => {
    if (!open) return;

    setSeparateMode(
      (impact !== undefined || urgency !== undefined) &&
        (impact === undefined || urgency === undefined || impact !== urgency),
    );
    setTempImpact(impact ?? urgency ?? undefined);
    setTempUrgency(urgency ?? impact ?? undefined);
  }, [open, impact, urgency]);

  const combinedPriority = useMemo(
    () => calculatePriority(impact, urgency),
    [impact, urgency],
  );

  const applySeparatePriority = () => {
    if (tempImpact === undefined && tempUrgency === undefined) {
      onClearPriority?.();
      setOpen(false);
      return;
    }

    onSelectPriority(tempImpact, tempUrgency);
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
          title={t("tasks.priority")}
          className="shrink-0 p-2 text-muted-foreground hover:text-foreground"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t("tasks.priority")}</div>
            <div className="text-xs text-muted-foreground">
              {t("tasks.quickPriorityHelp")}
            </div>
            {combinedPriority ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {t("tasks.currentPriorityValue", { value: combinedPriority })}
              </div>
            ) : null}
          </div>
          {(impact || urgency) && onClearPriority ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                onClearPriority();
                setOpen(false);
              }}
              title={t("tasks.clearPriority")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="mb-3 flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <div className="text-sm font-medium">
              {t("tasks.separatePriority")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("tasks.separatePriorityHelp")}
            </div>
          </div>
          <Switch checked={separateMode} onCheckedChange={setSeparateMode} />
        </div>

        {!separateMode ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("tasks.prioritySingleValue")}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PRIORITY_VALUES.map((value) => {
                const isActive = impact === value && urgency === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => {
                      onSelectPriority(value, value);
                      setOpen(false);
                    }}
                  >
                    {value}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("tasks.impact")}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PRIORITY_VALUES.map((value) => (
                  <Button
                    key={`impact-${value}`}
                    type="button"
                    variant={tempImpact === value ? "default" : "outline"}
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setTempImpact(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("tasks.urgency")}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PRIORITY_VALUES.map((value) => (
                  <Button
                    key={`urgency-${value}`}
                    type="button"
                    variant={tempUrgency === value ? "default" : "outline"}
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setTempUrgency(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div className="text-xs text-muted-foreground">
                {t("tasks.currentPriorityValue", {
                  value: calculatePriority(tempImpact, tempUrgency) ?? 0,
                })}
              </div>
              <Button type="button" size="sm" onClick={applySeparatePriority}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
