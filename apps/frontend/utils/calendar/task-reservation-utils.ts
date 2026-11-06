import {
  addMinutes,
  differenceInMinutes,
  isAfter,
  isBefore,
  max as maxDate,
  min as minDate,
} from "date-fns";

import { CanDoItemDecrypted } from "@/utils/api/types";
import { CalendarEvent } from "@/utils/calendar/calendar-types";
import { calculateRecommendationScore } from "@/utils/can-do-list/recommendation-utils";
import { isTaskActuallyBlocked } from "@/utils/can-do-list/task-blocking-utils";
import {
  getExecutionWindows,
  hasExecutionConstraints,
} from "@/utils/can-do-list/execution-constraints";

export type TaskAutoplanMode = "important-first" | "best-fit" | "balanced";

export interface TaskReservationGroupSlot {
  groupEvent: CalendarEvent;
  start: Date;
  end: Date;
}

export interface TaskAutoplanAssignment {
  task: CanDoItemDecrypted;
  groupEvent: CalendarEvent;
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface TaskAutoplanPreview {
  assignments: TaskAutoplanAssignment[];
  unplannedTasks: CanDoItemDecrypted[];
  /**
   * Unplanned tasks that have no usable time in any reservation space because of their
   * execution constraints (start date, weekdays, time window), regardless of other tasks.
   */
  constraintBlockedTasks: CanDoItemDecrypted[];
  eligibleTasks: CanDoItemDecrypted[];
  reservationGroups: CalendarEvent[];
  availableSlots: TaskReservationGroupSlot[];
}

interface FreeInterval {
  start: Date;
  end: Date;
}

/** A reservation slot together with the parts of it that are not yet taken by a planned task. */
interface SlotCursor extends TaskReservationGroupSlot {
  free: FreeInterval[];
}

interface Placement {
  start: Date;
  end: Date;
}

const DEFAULT_TASK_DURATION_MINUTES = 60;
const MIN_TASK_DURATION_MINUTES = 15;

export function isTaskReservationGroup(event: CalendarEvent): boolean {
  return Boolean(
    event.is_group_event &&
      event.is_task_reservation_space &&
      !event.parent_group_event_id &&
      !event.all_day,
  );
}

function getTaskDurationMinutes(task: CanDoItemDecrypted): number {
  return Math.max(
    MIN_TASK_DURATION_MINUTES,
    task.duration_minutes ?? DEFAULT_TASK_DURATION_MINUTES,
  );
}

function getTaskPriorityScore(
  task: CanDoItemDecrypted,
  allTasks: CanDoItemDecrypted[],
): number {
  return calculateRecommendationScore(task, allTasks);
}

export function getEligibleAutoplanTasks(
  tasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
  events: CalendarEvent[],
): CanDoItemDecrypted[] {
  const scheduledTaskIds = new Set(
    events.filter((event) => event.task_id).map((event) => event.task_id!),
  );

  return tasks.filter(
    (task) =>
      !task.completed &&
      !scheduledTaskIds.has(task.id) &&
      !isTaskActuallyBlocked(task, allTasks),
  );
}

export function getAvailableTaskReservationSlots(
  events: CalendarEvent[],
  now: Date,
): TaskReservationGroupSlot[] {
  const reservationGroups = events
    .filter(isTaskReservationGroup)
    .filter((event) => !event.recurrence_rule)
    .sort(
      (left, right) =>
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    );

  const slots: TaskReservationGroupSlot[] = [];

  for (const groupEvent of reservationGroups) {
    const groupStart = new Date(groupEvent.start_time);
    const groupEnd = new Date(groupEvent.end_time);

    if (!isAfter(groupEnd, now)) {
      continue;
    }

    const effectiveStart = maxDate([groupStart, now]);
    const childEvents = events
      .filter((event) => event.parent_group_event_id === groupEvent.id)
      .sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
      );

    let cursor = effectiveStart;

    for (const childEvent of childEvents) {
      const childStart = new Date(childEvent.start_time);
      const childEnd = new Date(childEvent.end_time);

      if (!isAfter(childEnd, effectiveStart) || !isBefore(childStart, groupEnd)) {
        continue;
      }

      const boundedChildStart = maxDate([childStart, effectiveStart]);
      const boundedChildEnd = minDate([childEnd, groupEnd]);

      if (isAfter(boundedChildStart, cursor)) {
        slots.push({
          groupEvent,
          start: cursor,
          end: boundedChildStart,
        });
      }

      if (isAfter(boundedChildEnd, cursor)) {
        cursor = boundedChildEnd;
      }
    }

    if (isAfter(groupEnd, cursor)) {
      slots.push({
        groupEvent,
        start: cursor,
        end: groupEnd,
      });
    }
  }

  return slots.filter(
    (slot) => differenceInMinutes(slot.end, slot.start) >= MIN_TASK_DURATION_MINUTES,
  );
}

function sortTasksByImportance(
  tasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
): CanDoItemDecrypted[] {
  return [...tasks].sort((left, right) => {
    const scoreDiff =
      getTaskPriorityScore(right, allTasks) - getTaskPriorityScore(left, allTasks);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return (
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
  });
}

function createSlotCursors(slots: TaskReservationGroupSlot[]): SlotCursor[] {
  return slots.map((slot) => ({
    ...slot,
    free: [{ start: new Date(slot.start), end: new Date(slot.end) }],
  }));
}

/**
 * Earliest place in the slot where the task fits completely, honoring its execution
 * constraints (start date, weekdays, time window). Returns null if there is none.
 */
function findPlacement(slot: SlotCursor, task: CanDoItemDecrypted): Placement | null {
  const durationMinutes = getTaskDurationMinutes(task);

  for (const interval of slot.free) {
    for (const window of getExecutionWindows(task, interval.start, interval.end)) {
      if (differenceInMinutes(window.end, window.start) >= durationMinutes) {
        return {
          start: new Date(window.start),
          end: addMinutes(window.start, durationMinutes),
        };
      }
    }
  }

  return null;
}

function assignTaskToSlot(
  slot: SlotCursor,
  task: CanDoItemDecrypted,
  placement: Placement,
): TaskAutoplanAssignment {
  // Take the placed time out of the free intervals (it may split one into two).
  slot.free = slot.free.flatMap((interval) => {
    if (
      !isBefore(placement.start, interval.end) ||
      !isAfter(placement.end, interval.start)
    ) {
      return [interval];
    }

    const remaining: FreeInterval[] = [];
    if (isAfter(placement.start, interval.start)) {
      remaining.push({ start: interval.start, end: placement.start });
    }
    if (isBefore(placement.end, interval.end)) {
      remaining.push({ start: placement.end, end: interval.end });
    }
    return remaining;
  });

  return {
    task,
    groupEvent: slot.groupEvent,
    start: placement.start,
    end: placement.end,
    durationMinutes: getTaskDurationMinutes(task),
  };
}

function getSlotRemainingMinutes(slot: SlotCursor): number {
  return slot.free.reduce(
    (total, interval) => total + differenceInMinutes(interval.end, interval.start),
    0,
  );
}

function planImportantFirst(
  tasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
  slots: SlotCursor[],
  taskCount: number,
): TaskAutoplanAssignment[] {
  const assignments: TaskAutoplanAssignment[] = [];
  const sortedTasks = sortTasksByImportance(tasks, allTasks);

  for (const task of sortedTasks) {
    if (assignments.length >= taskCount) {
      break;
    }

    for (const slot of slots) {
      const placement = findPlacement(slot, task);
      if (placement) {
        assignments.push(assignTaskToSlot(slot, task, placement));
        break;
      }
    }
  }

  return assignments;
}

function pickBestFitTask(
  tasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
  slot: SlotCursor,
  mode: "best-fit" | "balanced",
): { task: CanDoItemDecrypted; placement: Placement } | null {
  const remainingMinutes = getSlotRemainingMinutes(slot);
  const placements = new Map<string, Placement>();
  const fittingTasks: CanDoItemDecrypted[] = [];

  for (const task of tasks) {
    const placement = findPlacement(slot, task);
    if (placement) {
      placements.set(task.id, placement);
      fittingTasks.push(task);
    }
  }

  if (fittingTasks.length === 0) {
    return null;
  }

  const chosen = rankFittingTasks(fittingTasks, allTasks, remainingMinutes, mode);
  return { task: chosen, placement: placements.get(chosen.id)! };
}

function rankFittingTasks(
  fittingTasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
  remainingMinutes: number,
  mode: "best-fit" | "balanced",
): CanDoItemDecrypted {
  if (mode === "best-fit") {
    return fittingTasks.sort((left, right) => {
      const leftGap = remainingMinutes - getTaskDurationMinutes(left);
      const rightGap = remainingMinutes - getTaskDurationMinutes(right);
      if (leftGap !== rightGap) {
        return leftGap - rightGap;
      }

      return (
        getTaskPriorityScore(right, allTasks) -
        getTaskPriorityScore(left, allTasks)
      );
    })[0];
  }

  const scores = fittingTasks.map((task) => getTaskPriorityScore(task, allTasks));
  const maxPriority = Math.max(...scores, 1);

  return fittingTasks.sort((left, right) => {
    const leftFit = getTaskDurationMinutes(left) / remainingMinutes;
    const rightFit = getTaskDurationMinutes(right) / remainingMinutes;
    const leftPriority = getTaskPriorityScore(left, allTasks) / maxPriority;
    const rightPriority = getTaskPriorityScore(right, allTasks) / maxPriority;
    const leftScore = leftFit * 0.5 + leftPriority * 0.5;
    const rightScore = rightFit * 0.5 + rightPriority * 0.5;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return getTaskDurationMinutes(right) - getTaskDurationMinutes(left);
  })[0];
}

function planBySlotPacking(
  tasks: CanDoItemDecrypted[],
  allTasks: CanDoItemDecrypted[],
  slots: SlotCursor[],
  taskCount: number,
  mode: "best-fit" | "balanced",
): TaskAutoplanAssignment[] {
  const assignments: TaskAutoplanAssignment[] = [];
  const remainingTasks = [...tasks];

  for (const slot of slots) {
    while (assignments.length < taskCount) {
      const chosen = pickBestFitTask(remainingTasks, allTasks, slot, mode);

      if (!chosen) {
        break;
      }

      assignments.push(assignTaskToSlot(slot, chosen.task, chosen.placement));
      const chosenIndex = remainingTasks.findIndex((task) => task.id === chosen.task.id);
      if (chosenIndex >= 0) {
        remainingTasks.splice(chosenIndex, 1);
      }
    }
  }

  return assignments;
}

export function buildTaskAutoplanPreview(params: {
  tasks: CanDoItemDecrypted[];
  allTasks: CanDoItemDecrypted[];
  events: CalendarEvent[];
  mode: TaskAutoplanMode;
  taskCount: number;
  now?: Date;
}): TaskAutoplanPreview {
  const now = params.now ?? new Date();
  const eligibleTasks = getEligibleAutoplanTasks(
    params.tasks,
    params.allTasks,
    params.events,
  );
  const availableSlots = getAvailableTaskReservationSlots(params.events, now);
  const slotCursors = createSlotCursors(availableSlots);

  let assignments: TaskAutoplanAssignment[] = [];
  if (params.mode === "important-first") {
    assignments = planImportantFirst(
      eligibleTasks,
      params.allTasks,
      slotCursors,
      params.taskCount,
    );
  } else {
    assignments = planBySlotPacking(
      eligibleTasks,
      params.allTasks,
      slotCursors,
      params.taskCount,
      params.mode,
    );
  }

  const assignedTaskIds = new Set(assignments.map((assignment) => assignment.task.id));
  const unplannedTasks = eligibleTasks.filter((task) => !assignedTaskIds.has(task.id));

  // Constrained tasks that could not be planned and would not fit into any slot even if it were
  // completely empty - so their execution constraints (not a lack of time) are what keeps them out.
  const emptySlots = createSlotCursors(availableSlots);
  const constraintBlockedTasks = unplannedTasks.filter(
    (task) =>
      hasExecutionConstraints(task) &&
      !emptySlots.some((slot) => findPlacement(slot, task) !== null),
  );

  return {
    assignments,
    unplannedTasks,
    constraintBlockedTasks,
    eligibleTasks,
    reservationGroups: availableSlots.map((slot) => slot.groupEvent),
    availableSlots,
  };
}
