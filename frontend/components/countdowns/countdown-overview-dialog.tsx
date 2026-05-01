"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import { CanDoItemDecrypted, CountdownDecrypted } from "@/utils/api/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/shadcn-utils";
import {
  CalendarClock,
  Check,
  ChevronsUpDown,
  Link2,
  Timer,
  Trash2,
} from "lucide-react";

interface CountdownOverviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly countdowns: CountdownDecrypted[];
  readonly events: CalendarEvent[];
  readonly tasks: CanDoItemDecrypted[];
  readonly onCreateCountdown: (input: {
    eventId: string;
    target: "start" | "end";
    taskId?: string;
  }) => Promise<void>;
  readonly onDeleteCountdown: (id: string) => Promise<void>;
}

function getCountdownTimestamp(
  event: CalendarEvent | undefined,
  target: "start" | "end",
): number | null {
  if (!event) {
    return null;
  }

  const rawDate = target === "end" ? event.end_time : event.start_time;
  return new Date(rawDate).getTime();
}

function formatRemainingTime(
  timestamp: number | null,
  now: number,
  target: "start" | "end",
): string {
  if (timestamp === null) {
    return "Event unavailable";
  }

  const difference = timestamp - now;
  if (difference <= 0) {
    return target === "end" ? "Event ended" : "Event started";
  }

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    ...(days > 0 ? [`${days}d`] : []),
    ...(days > 0 || hours > 0 ? [`${hours.toString().padStart(2, "0")}h`] : []),
    `${minutes.toString().padStart(2, "0")}m`,
    `${seconds.toString().padStart(2, "0")}s`,
  ];
  return parts.join(" ");
}

export function CountdownOverviewDialog({
  open,
  onOpenChange,
  countdowns,
  events,
  tasks,
  onCreateCountdown,
  onDeleteCountdown,
}: CountdownOverviewDialogProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<"start" | "end">("start");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }

    setNow(Date.now());
    const intervalId = globalThis.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [open]);

  const availableEvents = useMemo(() => {
    return [...events].sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    );
  }, [events]);

  useEffect(() => {
    if (selectedEventId || availableEvents.length === 0) {
      return;
    }

    setSelectedEventId(availableEvents[0].id);
  }, [availableEvents, selectedEventId]);

  const sortedCountdowns = useMemo(() => {
    return [...countdowns].sort((left, right) => {
      const leftTimestamp = getCountdownTimestamp(
        events.find((event) => event.id === left.event_id),
        left.target,
      );
      const rightTimestamp = getCountdownTimestamp(
        events.find((event) => event.id === right.event_id),
        right.target,
      );

      if (leftTimestamp === null) {
        return 1;
      }
      if (rightTimestamp === null) {
        return -1;
      }
      return leftTimestamp - rightTimestamp;
    });
  }, [countdowns, events]);

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId)
    : undefined;

  const handleCreate = async () => {
    if (!selectedEventId) {
      return;
    }

    try {
      setIsCreating(true);
      await onCreateCountdown({
        eventId: selectedEventId,
        target: selectedTarget,
        taskId: selectedTaskId || undefined,
      });
      setSelectedTaskId("");
      setSelectedTarget("start");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (countdownId: string) => {
    try {
      setDeletingId(countdownId);
      await onDeleteCountdown(countdownId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Event Countdowns
          </DialogTitle>
          <DialogDescription>
            Create countdowns for calendar events, optionally link them to tasks, and remove them when you no longer need them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="space-y-4 rounded-lg border bg-card p-4">
            <div className="space-y-1">
              <h3 className="font-medium">Create Countdown</h3>
              <p className="text-sm text-muted-foreground">
                Pick an event, choose whether the countdown ends at the start or end, and optionally attach a task.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countdown-event">Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger id="countdown-event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {availableEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{event.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.start_time), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countdown-target">Countdown Target</Label>
              <Select
                value={selectedTarget}
                onValueChange={(value: "start" | "end") => setSelectedTarget(value)}
              >
                <SelectTrigger id="countdown-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Event start</SelectItem>
                  <SelectItem value="end">Event end</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Linked Task</Label>
              <Popover open={taskSearchOpen} onOpenChange={setTaskSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedTask ? selectedTask.content : "Attach a task (optional)"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tasks..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No matching task.</CommandEmpty>
                      <CommandGroup>
                        {tasks.map((task) => (
                          <CommandItem
                            key={task.id}
                            value={`${task.content} ${task.project_id ?? ""}`}
                            onSelect={() => {
                              setSelectedTaskId(task.id);
                              setTaskSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTaskId === task.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{task.content}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedTask ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedTask.content}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTaskId("")}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>

            <Button onClick={handleCreate} disabled={!selectedEventId || isCreating} className="w-full">
              {isCreating ? "Creating..." : "Create countdown"}
            </Button>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-4">
            <div className="space-y-1">
              <h3 className="font-medium">Current Countdowns</h3>
              <p className="text-sm text-muted-foreground">
                Your saved countdowns update live while this overview is open.
              </p>
            </div>

            <div className="space-y-3">
              {sortedCountdowns.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No countdowns yet.
                </div>
              ) : (
                sortedCountdowns.map((countdown) => {
                  const event = events.find((entry) => entry.id === countdown.event_id);
                  const task = countdown.task_id
                    ? tasks.find((entry) => entry.id === countdown.task_id)
                    : undefined;
                  const targetTimestamp = getCountdownTimestamp(event, countdown.target);

                  return (
                    <div
                      key={countdown.id}
                      className="rounded-lg border p-4 shadow-sm transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <h4 className="truncate font-medium">
                              {event?.title ?? "Event unavailable"}
                            </h4>
                            <Badge variant="secondary">
                              {countdown.target === "end" ? "Ends at" : "Starts at"}
                            </Badge>
                          </div>

                          <div className="text-2xl font-semibold tracking-tight">
                            {formatRemainingTime(targetTimestamp, now, countdown.target)}
                          </div>

                          {event ? (
                            <p className="text-sm text-muted-foreground">
                              {format(
                                new Date(
                                  countdown.target === "end"
                                    ? event.end_time
                                    : event.start_time,
                                ),
                                "MMM d, yyyy HH:mm",
                              )}
                            </p>
                          ) : null}

                          {task ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Link2 className="h-4 w-4" />
                              <span className="truncate">{task.content}</span>
                            </div>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(countdown.id)}
                          disabled={deletingId === countdown.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}