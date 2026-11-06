import {
  getExecutionWindows,
  hasExecutionConstraints,
  isTaskDoableToday,
  isTaskExecutableOnDay,
} from '@/utils/can-do-list/execution-constraints';
import { getRecommendedTasks } from '@/utils/can-do-list/recommendation-utils';
import { buildTaskAutoplanPreview } from '@/utils/calendar/task-reservation-utils';
import { CanDoItemDecrypted } from '@/utils/api/types';
import { CalendarEvent } from '@/utils/calendar/calendar-types';

// Local-time helper. 2026-11-09 is a Monday.
const at = (day: number, hours = 0, minutes = 0) => new Date(2026, 10, day, hours, minutes);
const MONDAY = 1;
const TUESDAY = 2;

function makeTask(overrides: Partial<CanDoItemDecrypted> = {}): CanDoItemDecrypted {
  return {
    id: overrides.id ?? 't1',
    user_id: 'u',
    display_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    content: overrides.id ?? 'task',
    completed: false,
    duration_minutes: 60,
    ...overrides,
  };
}

function makeReservation(id: string, start: Date, end: Date): CalendarEvent {
  return {
    id,
    title: 'Reservation',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    all_day: false,
    calendar_id: 'c',
    is_group_event: true,
    is_task_reservation_space: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'u',
  };
}

describe('execution constraints', () => {
  it('sanity: test dates are the weekdays the tests assume', () => {
    expect(at(9).getDay()).toBe(MONDAY);
    expect(at(10).getDay()).toBe(TUESDAY);
  });

  it('treats tasks without constraints (or with empty ones) as unrestricted', () => {
    expect(hasExecutionConstraints(makeTask())).toBe(false);
    expect(hasExecutionConstraints(makeTask({ allowed_weekdays: [], allowed_from_date: '' }))).toBe(false);
    expect(isTaskDoableToday(makeTask(), at(9, 12))).toBe(true);
  });

  it('respects the start date and weekdays per day', () => {
    const task = makeTask({ allowed_from_date: '2026-11-10', allowed_weekdays: [TUESDAY] });
    expect(isTaskExecutableOnDay(task, at(9))).toBe(false); // before start date and wrong weekday
    expect(isTaskExecutableOnDay(task, at(10))).toBe(true);
    expect(isTaskExecutableOnDay(task, at(17))).toBe(true); // next Tuesday
    expect(isTaskExecutableOnDay(task, at(11))).toBe(false); // Wednesday
  });

  it('computes execution windows inside a range', () => {
    const task = makeTask({ allowed_weekdays: [TUESDAY], allowed_time_start: '09:00', allowed_time_end: '12:00' });
    const windows = getExecutionWindows(task, at(9, 8), at(11, 18));
    expect(windows).toEqual([{ start: at(10, 9), end: at(10, 12) }]);
  });

  it('clips windows to the requested range', () => {
    const task = makeTask({ allowed_time_start: '09:00', allowed_time_end: '12:00' });
    expect(getExecutionWindows(task, at(9, 10), at(9, 11))).toEqual([{ start: at(9, 10), end: at(9, 11) }]);
    expect(getExecutionWindows(task, at(9, 13), at(9, 18))).toEqual([]);
  });

  it('ignores a half-set or inverted time period', () => {
    expect(hasExecutionConstraints(makeTask({ allowed_time_start: '09:00' }))).toBe(false);
    expect(hasExecutionConstraints(makeTask({ allowed_time_start: '12:00', allowed_time_end: '09:00' }))).toBe(false);
  });

  it('isTaskDoableToday: window that is over today is not doable, one opening later is', () => {
    const task = makeTask({ allowed_time_start: '09:00', allowed_time_end: '12:00' });
    expect(isTaskDoableToday(task, at(9, 7))).toBe(true);
    expect(isTaskDoableToday(task, at(9, 11))).toBe(true);
    expect(isTaskDoableToday(task, at(9, 12))).toBe(false);
  });
});

describe('recommended tasks', () => {
  it('leaves out tasks that cannot be done today', () => {
    const now = at(9, 10); // Monday
    const free = makeTask({ id: 'free', impact: 1 });
    const future = makeTask({ id: 'future', impact: 10, allowed_from_date: '2026-11-12' });
    const tuesdayOnly = makeTask({ id: 'tue', impact: 10, allowed_weekdays: [TUESDAY] });
    const mondayOnly = makeTask({ id: 'mon', impact: 5, allowed_weekdays: [MONDAY] });

    const ids = getRecommendedTasks([free, future, tuesdayOnly, mondayOnly], 20, now).map((t) => t.id);
    expect(ids).toEqual(['mon', 'free']);
  });
});

describe('autoplan', () => {
  const plan = (tasks: CanDoItemDecrypted[], events: CalendarEvent[], now = at(9, 7)) =>
    buildTaskAutoplanPreview({ tasks, allTasks: tasks, events, mode: 'important-first', taskCount: 10, now });

  it('packs unconstrained tasks back to back like before', () => {
    const preview = plan(
      [makeTask({ id: 'a', impact: 9 }), makeTask({ id: 'b', impact: 5 })],
      [makeReservation('r', at(9, 9), at(9, 12))],
    );
    expect(preview.assignments.map((a) => [a.task.id, a.start, a.end])).toEqual([
      ['a', at(9, 9), at(9, 10)],
      ['b', at(9, 10), at(9, 11)],
    ]);
    expect(preview.constraintBlockedTasks).toEqual([]);
  });

  it('places a task inside its time window, leaving the earlier time free for others', () => {
    const preview = plan(
      [
        makeTask({ id: 'late', impact: 9, allowed_time_start: '10:00', allowed_time_end: '12:00' }),
        makeTask({ id: 'any', impact: 1 }),
      ],
      [makeReservation('r', at(9, 9), at(9, 12))],
    );
    const byId = Object.fromEntries(preview.assignments.map((a) => [a.task.id, a]));
    expect(byId.late.start).toEqual(at(9, 10));
    expect(byId.late.end).toEqual(at(9, 11));
    expect(byId.any.start).toEqual(at(9, 9)); // fills the time before the window opens
    expect(byId.any.end).toEqual(at(9, 10));
  });

  it('only uses reservation spaces on allowed weekdays and after the start date', () => {
    const preview = plan(
      [makeTask({ id: 'tue', allowed_weekdays: [TUESDAY] })],
      [makeReservation('mon', at(9, 9), at(9, 12)), makeReservation('tue', at(10, 9), at(10, 12))],
    );
    expect(preview.assignments).toHaveLength(1);
    expect(preview.assignments[0].groupEvent.id).toBe('tue');

    const future = plan(
      [makeTask({ id: 'later', allowed_from_date: '2026-11-11' })],
      [makeReservation('mon', at(9, 9), at(9, 12)), makeReservation('tue', at(10, 9), at(10, 12))],
    );
    expect(future.assignments).toHaveLength(0);
  });

  it('skips tasks that no slot can host and reports them as constraint-blocked', () => {
    const blocked = makeTask({ id: 'blocked', allowed_time_start: '18:00', allowed_time_end: '20:00' });
    const preview = plan([blocked, makeTask({ id: 'ok' })], [makeReservation('r', at(9, 9), at(9, 12))]);
    expect(preview.assignments.map((a) => a.task.id)).toEqual(['ok']);
    expect(preview.unplannedTasks.map((t) => t.id)).toEqual(['blocked']);
    expect(preview.constraintBlockedTasks.map((t) => t.id)).toEqual(['blocked']);
  });

  it('does not call a task constraint-blocked when it was merely crowded out', () => {
    const preview = plan(
      [makeTask({ id: 'a', impact: 9, duration_minutes: 120 }), makeTask({ id: 'b', impact: 1, duration_minutes: 120 })],
      [makeReservation('r', at(9, 9), at(9, 11))],
    );
    expect(preview.unplannedTasks.map((t) => t.id)).toEqual(['b']);
    expect(preview.constraintBlockedTasks).toEqual([]);
  });

  it('respects constraints in the slot-packing modes as well', () => {
    for (const mode of ['best-fit', 'balanced'] as const) {
      const preview = buildTaskAutoplanPreview({
        tasks: [makeTask({ id: 'late', allowed_time_start: '11:00', allowed_time_end: '12:00' })],
        allTasks: [makeTask({ id: 'late', allowed_time_start: '11:00', allowed_time_end: '12:00' })],
        events: [makeReservation('r', at(9, 9), at(9, 12))],
        mode,
        taskCount: 5,
        now: at(9, 7),
      });
      expect(preview.assignments).toHaveLength(1);
      expect(preview.assignments[0].start).toEqual(at(9, 11));
    }
  });
});
