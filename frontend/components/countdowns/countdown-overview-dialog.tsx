"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Fuse from "fuse.js";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import { CountdownDecrypted } from "@/utils/api/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  Calendar as CalendarIcon,
  Search,
  Timer,
  Trash2,
} from "lucide-react";

interface CountdownOverviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly countdowns: CountdownDecrypted[];
  readonly events: CalendarEvent[];
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
  onCreateCountdown,
  onDeleteCountdown,
}: CountdownOverviewDialogProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<"start" | "end">("start");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableEvents = useMemo(() => {
    return [...events].sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    );
  }, [events]);

  const eventSearch = useMemo(
    () =>
      new Fuse(availableEvents, {
        keys: [
          { name: "title", weight: 2 },
          { name: "description", weight: 1 },
          { name: "location", weight: 1 },
        ],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [availableEvents],
  );

  const filteredEvents = useMemo(() => {
    const trimmedQuery = eventSearchQuery.trim();
    if (!trimmedQuery) {
      return availableEvents.slice(0, 12);
    }

    return eventSearch.search(trimmedQuery).slice(0, 12).map((result) => result.item);
  }, [availableEvents, eventSearch, eventSearchQuery]);

  useEffect(() => {
    if (selectedEventId || availableEvents.length === 0) {
      return;
    }

    setSelectedEventId(availableEvents[0].id);
  }, [availableEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => availableEvents.find((event) => event.id === selectedEventId),
    [availableEvents, selectedEventId],
  );

  const formatEventTime = (event: CalendarEvent) => {
    if (event.all_day) {
      return "All day";
    }

    const start = format(new Date(event.start_time), "HH:mm");
    const end = format(new Date(event.end_time), "HH:mm");
    return `${start} - ${end}`;
  };

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

  const handleCreate = async () => {
    if (!selectedEventId) {
      return;
    }

    try {
      setIsCreating(true);
      await onCreateCountdown({
        eventId: selectedEventId,
        target: selectedTarget,
      });
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

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
    setEventSearchQuery("");
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-w-[96vw] sm:max-w-[94vw] lg:max-w-[92vw] overflow-hidden p-0">
        <div className="flex h-full flex-col overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Event Countdowns
          </DialogTitle>
          <DialogDescription>
            Create countdowns for calendar events and remove them when you no longer need them.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <section className="space-y-4 rounded-lg border bg-card p-4 overflow-visible">
            <div className="space-y-1">
              <h3 className="font-medium">Create Countdown</h3>
              <p className="text-sm text-muted-foreground">
                Pick an event, choose whether the countdown ends at the start or end, then create the countdown.
              </p>
            </div>

            <div className="space-y-3 min-h-0 overflow-visible">
              <Label htmlFor="countdown-event">Event</Label>
              <div ref={dropdownRef} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="countdown-event"
                  ref={inputRef}
                  value={eventSearchQuery}
                  onChange={(event) => {
                    setEventSearchQuery(event.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Search events"
                  className="pl-9"
                />

                {isDropdownOpen && filteredEvents.length > 0 ? (
                  <div className="absolute z-50 mt-1 max-h-[400px] w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleEventClick(event)}
                        className="flex w-full items-start gap-3 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                      >
                        <CalendarIcon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{event.title}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {format(new Date(event.start_time), "EEE, MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatEventTime(event)}
                          </div>
                          {event.location ? (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {event.location}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {isDropdownOpen && eventSearchQuery.trim() && filteredEvents.length === 0 ? (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
                    <p className="text-center text-sm text-muted-foreground">No matching events.</p>
                  </div>
                ) : null}
              </div>

              {selectedEvent ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <div className="truncate font-medium">{selectedEvent.title}</div>
                  <div className="text-muted-foreground">
                    {format(new Date(selectedEvent.start_time), "MMM d, yyyy HH:mm")}
                  </div>
                </div>
              ) : null}

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

            <Button onClick={handleCreate} disabled={!selectedEventId || isCreating} className="w-full">
              {isCreating ? "Creating..." : "Create countdown"}
            </Button>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-4 min-h-0 overflow-hidden">
            <div className="space-y-1">
              <h3 className="font-medium">Current Countdowns</h3>
              <p className="text-sm text-muted-foreground">
                Your saved countdowns update live while this overview is open.
              </p>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {sortedCountdowns.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No countdowns yet.
                </div>
              ) : (
                sortedCountdowns.map((countdown) => {
                  const event = events.find((entry) => entry.id === countdown.event_id);
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
        </div>
      </DialogContent>
    </Dialog>
  );
}