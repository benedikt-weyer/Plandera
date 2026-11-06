import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { CalendarEvent } from '@/utils/calendar/calendar-types';

const at = (day: number, hours = 0) => new Date(2026, 10, day, hours);

function makeEvent(overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: overrides.id,
    start_time: at(9, 9).toISOString(),
    end_time: at(9, 10).toISOString(),
    all_day: false,
    calendar_id: 'cal',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'u',
    ...overrides,
  };
}

function makeService(options: { failOnCreateNumber?: number } = {}) {
  let counter = 0;
  const created: any[] = [];
  const deleted: string[] = [];
  const backend: any = {
    calendarEvents: {
      create: jest.fn(async (request: any) => {
        counter += 1;
        if (options.failOnCreateNumber === counter) throw new Error('boom');
        const data = { ...request, id: `new-${counter}`, user_id: 'u', created_at: '', updated_at: '' };
        created.push(data);
        return { data, error: null };
      }),
      delete: jest.fn(async (id: string) => {
        deleted.push(id);
        return { error: null };
      }),
    },
  };
  return { service: new CalendarEventsService(backend), created, deleted };
}

const group = makeEvent({
  id: 'group',
  title: 'Focus block',
  start_time: at(9, 9).toISOString(),
  end_time: at(9, 13).toISOString(),
  is_group_event: true,
  is_task_reservation_space: true,
});
const childA = makeEvent({
  id: 'a',
  title: 'Write report',
  start_time: at(9, 10).toISOString(),
  end_time: at(9, 11).toISOString(),
  parent_group_event_id: 'group',
  task_id: 'task-1',
});
const childB = makeEvent({
  id: 'b',
  title: 'Review',
  start_time: at(9, 11).toISOString(),
  end_time: at(9, 12).toISOString(),
  parent_group_event_id: 'group',
});
const otherGroupChild = makeEvent({ id: 'x', title: 'Elsewhere', parent_group_event_id: 'other-group' });
const plain = makeEvent({ id: 'plain', title: 'Lunch' });

describe('cloneCalendarEvent', () => {
  it('clones an event group as a new group of the same kind, with all of its children inside it', async () => {
    const { service, created } = makeService();

    const result = await service.cloneCalendarEvent(group, [group, childA, childB, otherGroupChild, plain]);

    expect(result.map(e => e.id)).toEqual(['new-1', 'new-2', 'new-3']);
    const [newGroup, newA, newB] = created;
    expect(newGroup.is_group_event).toBe(true);
    expect(newGroup.is_task_reservation_space).toBe(true);
    expect(newGroup.parent_group_event_id).toBeUndefined();
    expect(newGroup.title).toBe('Focus block');

    expect(newA.parent_group_event_id).toBe('new-1');
    expect(newB.parent_group_event_id).toBe('new-1');
    expect([newA.title, newB.title]).toEqual(['Write report', 'Review']);
    expect(newA.start_time).toBe(childA.start_time);
    expect(newB.end_time).toBe(childB.end_time);
    // children are plain events, not groups, and do not take over the original's task link
    expect(newA.is_group_event).toBeFalsy();
    expect(newA.task_id).toBeUndefined();
  });

  it('clones a normal group (not a reservation space) without the reservation flag', async () => {
    const { service, created } = makeService();
    const normalGroup = makeEvent({ ...group, is_task_reservation_space: false });

    await service.cloneCalendarEvent(normalGroup, [normalGroup, childA]);

    expect(created[0].is_group_event).toBe(true);
    expect(created[0].is_task_reservation_space).toBeFalsy();
  });

  it('clones a group without children', async () => {
    const { service, created } = makeService();
    const result = await service.cloneCalendarEvent(group, [group]);
    expect(result).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0].is_group_event).toBe(true);
  });

  it('still clones a normal event as a single, non-group event', async () => {
    const { service, created } = makeService();
    const result = await service.cloneCalendarEvent(plain, [plain, group, childA]);
    expect(result).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0].is_group_event).toBeFalsy();
    expect(created[0].title).toBe('Lunch');
  });

  it('keeps children at the same place in a cloned recurrence instance of a group', async () => {
    const { service, created } = makeService();
    const instance = makeEvent({
      ...group,
      id: 'group-recurrence-2026-11-16',
      start_time: at(16, 9).toISOString(),
      end_time: at(16, 13).toISOString(),
    });

    await service.cloneCalendarEvent(instance, [group, childA]);

    expect(new Date(created[0].start_time)).toEqual(at(16, 9));
    expect(new Date(created[1].start_time)).toEqual(at(16, 10));
    expect(new Date(created[1].end_time)).toEqual(at(16, 11));
    expect(created[1].parent_group_event_id).toBe('new-1');
  });

  it('removes the partially cloned group again if cloning a child fails', async () => {
    const { service, deleted } = makeService({ failOnCreateNumber: 3 });

    await expect(service.cloneCalendarEvent(group, [group, childA, childB])).rejects.toThrow('Failed to clone calendar event');
    expect(deleted.sort()).toEqual(['new-1', 'new-2']);
  });
});
