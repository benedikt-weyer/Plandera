/**
 * Helpers for a task's optional execution constraints:
 *  - allowed_from_date:  first day ("YYYY-MM-DD", local) the task can be done
 *  - allowed_weekdays:   days of the week (0 = Sunday ... 6 = Saturday) the task can be done; empty = every day
 *  - allowed_time_start / allowed_time_end: time-of-day window ("HH:mm") the task can be done; both or neither
 *
 * Everything is evaluated in the user's local time zone.
 */

import { addDays, format, set, startOfDay } from 'date-fns';

import { CanDoItemDecrypted } from '../api/types';

export type ExecutionConstraintFields = Pick<
  CanDoItemDecrypted,
  'allowed_from_date' | 'allowed_weekdays' | 'allowed_time_start' | 'allowed_time_end'
>;

export interface TimeWindow {
  start: Date;
  end: Date;
}

function parseTimeOfDay(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** The task's time-of-day window, or null if it has none (or an unusable one). */
function getTimeOfDayWindow(
  task: ExecutionConstraintFields,
): { start: { hours: number; minutes: number }; end: { hours: number; minutes: number } } | null {
  if (!task.allowed_time_start || !task.allowed_time_end) return null;
  const start = parseTimeOfDay(task.allowed_time_start);
  const end = parseTimeOfDay(task.allowed_time_end);
  if (!start || !end) return null;
  if (end.hours * 60 + end.minutes <= start.hours * 60 + start.minutes) return null;
  return { start, end };
}

export function hasExecutionConstraints(task: ExecutionConstraintFields): boolean {
  return Boolean(
    task.allowed_from_date ||
      (task.allowed_weekdays && task.allowed_weekdays.length > 0) ||
      getTimeOfDayWindow(task),
  );
}

/** Whether the task may be done at all on the given calendar day (ignores the time-of-day window). */
export function isTaskExecutableOnDay(task: ExecutionConstraintFields, day: Date): boolean {
  if (task.allowed_from_date && format(day, 'yyyy-MM-dd') < task.allowed_from_date) {
    return false;
  }
  if (task.allowed_weekdays && task.allowed_weekdays.length > 0) {
    return task.allowed_weekdays.includes(day.getDay());
  }
  return true;
}

/**
 * The parts of [from, to) in which the task may be done, in chronological order.
 * A task without constraints can use the whole range.
 */
export function getExecutionWindows(task: ExecutionConstraintFields, from: Date, to: Date): TimeWindow[] {
  if (from.getTime() >= to.getTime()) return [];
  if (!hasExecutionConstraints(task)) return [{ start: from, end: to }];

  const timeWindow = getTimeOfDayWindow(task);
  const windows: TimeWindow[] = [];

  for (let day = startOfDay(from); day.getTime() < to.getTime(); day = addDays(day, 1)) {
    if (!isTaskExecutableOnDay(task, day)) continue;

    let windowStart = day;
    let windowEnd = addDays(day, 1);
    if (timeWindow) {
      windowStart = set(day, { hours: timeWindow.start.hours, minutes: timeWindow.start.minutes, seconds: 0, milliseconds: 0 });
      windowEnd = set(day, { hours: timeWindow.end.hours, minutes: timeWindow.end.minutes, seconds: 0, milliseconds: 0 });
    }

    const start = windowStart.getTime() > from.getTime() ? windowStart : from;
    const end = windowEnd.getTime() < to.getTime() ? windowEnd : to;
    if (start.getTime() < end.getTime()) {
      windows.push({ start, end });
    }
  }

  return windows;
}

/**
 * Whether the task can still be done today at `now`: today is allowed (start date reached, weekday allowed)
 * and the time-of-day window, if any, has not ended yet. A window that opens later today still counts.
 */
export function isTaskDoableToday(task: ExecutionConstraintFields, now: Date = new Date()): boolean {
  if (!hasExecutionConstraints(task)) return true;
  if (!isTaskExecutableOnDay(task, now)) return false;

  const timeWindow = getTimeOfDayWindow(task);
  if (timeWindow) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= timeWindow.end.hours * 60 + timeWindow.end.minutes) return false;
  }
  return true;
}
