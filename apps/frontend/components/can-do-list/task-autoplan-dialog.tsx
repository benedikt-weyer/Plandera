"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Sparkles } from "lucide-react";

import { CanDoItemDecrypted } from "@/utils/api/types";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import {
  buildTaskAutoplanPreview,
  TaskAutoplanAssignment,
  TaskAutoplanMode,
} from "@/utils/calendar/task-reservation-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonGroup } from "@/components/ui/button-group";
import { useTranslation } from "@/utils/context/LanguageContext";

interface TaskAutoplanDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sourceLabel: string;
  readonly tasks: CanDoItemDecrypted[];
  readonly allTasks: CanDoItemDecrypted[];
  readonly events: CalendarEvent[];
  readonly onApply: (assignments: TaskAutoplanAssignment[]) => Promise<boolean>;
}

const MODES: Array<{ id: TaskAutoplanMode; labelKey: string }> = [
  { id: "important-first", labelKey: "tasks.autoplanModeImportantFirst" },
  { id: "best-fit", labelKey: "tasks.autoplanModeBestFit" },
  { id: "balanced", labelKey: "tasks.autoplanModeBalanced" },
];

export function TaskAutoplanDialog({
  open,
  onOpenChange,
  sourceLabel,
  tasks,
  allTasks,
  events,
  onApply,
}: TaskAutoplanDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<TaskAutoplanMode>("balanced");
  const [requestedTaskCount, setRequestedTaskCount] = useState("5");
  const [isApplying, setIsApplying] = useState(false);

  const taskCount = useMemo(() => {
    const parsed = Number.parseInt(requestedTaskCount, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1;
    }

    return parsed;
  }, [requestedTaskCount]);

  const preview = useMemo(
    () =>
      buildTaskAutoplanPreview({
        tasks,
        allTasks,
        events,
        mode,
        taskCount,
      }),
    [tasks, allTasks, events, mode, taskCount],
  );

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, TaskAutoplanAssignment[]>();

    for (const assignment of preview.assignments) {
      const bucket = groups.get(assignment.groupEvent.id) ?? [];
      bucket.push(assignment);
      groups.set(assignment.groupEvent.id, bucket);
    }

    return [...groups.entries()]
      .map(([groupId, assignments]) => ({
        group: assignments[0].groupEvent,
        assignments,
        groupId,
      }))
      .sort(
        (left, right) =>
          new Date(left.group.start_time).getTime() -
          new Date(right.group.start_time).getTime(),
      );
  }, [preview.assignments]);

  const handleApply = async () => {
    if (preview.assignments.length === 0 || isApplying) {
      return;
    }

    setIsApplying(true);
    try {
      const success = await onApply(preview.assignments);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("tasks.autoplanTasks")}</DialogTitle>
          <DialogDescription>
            {t("tasks.autoplanDialogDescription", { source: sourceLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div className="space-y-2">
              <div className="text-sm font-medium">{t("tasks.autoplanMode")}</div>
              <ButtonGroup className="w-full flex-wrap gap-2">
                {MODES.map((entry) => (
                  <Button
                    key={entry.id}
                    type="button"
                    variant={mode === entry.id ? "default" : "outline"}
                    className="flex-1 min-w-[140px]"
                    onClick={() => setMode(entry.id)}
                  >
                    {t(entry.labelKey)}
                  </Button>
                ))}
              </ButtonGroup>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t("tasks.autoplanTaskCount")}
              </div>
              <Input
                type="number"
                min={1}
                value={requestedTaskCount}
                onChange={(event) => setRequestedTaskCount(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("tasks.autoplanEligible")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {preview.eligibleTasks.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("tasks.autoplanReservationSpaces")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {preview.availableSlots.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("tasks.autoplanPlanned")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {preview.assignments.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("tasks.autoplanUnplanned")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {Math.max(0, taskCount - preview.assignments.length)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("tasks.autoplanPreview")}
            </div>

            {preview.availableSlots.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t("tasks.autoplanNoReservationSpaces")}
              </div>
            ) : preview.eligibleTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t("tasks.autoplanNoEligibleTasks")}
              </div>
            ) : preview.assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t("tasks.autoplanNoAssignments")}
              </div>
            ) : (
              <div className="space-y-3">
                {groupedAssignments.map(({ group, assignments, groupId }) => (
                  <div key={groupId} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{group.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(group.start_time), "EEE, MMM d • HH:mm")}
                          {" - "}
                          {format(new Date(group.end_time), "HH:mm")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {assignments.length}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {assignments.map((assignment) => (
                        <div
                          key={`${assignment.groupEvent.id}-${assignment.task.id}-${assignment.start.toISOString()}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {assignment.task.content}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(assignment.start, "HH:mm")}
                              {" - "}
                              {format(assignment.end, "HH:mm")}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {assignment.durationMinutes}m
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {preview.unplannedTasks.length > 0 ? (
              <div className="rounded-lg border border-dashed p-4">
                <div className="mb-2 text-sm font-medium">
                  {t("tasks.autoplanRemainingTasks")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {preview.unplannedTasks.slice(0, 8).map((task) => (
                    <span
                      key={task.id}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {task.content}
                    </span>
                  ))}
                  {preview.unplannedTasks.length > 8 ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      +{preview.unplannedTasks.length - 8}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={preview.assignments.length === 0 || isApplying}
          >
            {isApplying ? t("common.saving") : t("tasks.applyAutoplan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
