import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  getBaseEventId,
  getChildEventsForGroupInstance,
  getGroupChildrenForDay,
  getGroupEventStyle,
  isNestedGroupChild,
  resolveGroupChildForEdit,
} from '@/utils/calendar/event-groups';
import { CalendarDayAgenda } from '@/components/calendar/calendar-day-agenda';
import { CalendarEvent } from '@/utils/calendar/calendar-types';

const at = (day: number, hours = 0, minutes = 0) => new Date(2026, 10, day, hours, minutes);

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

const group = makeEvent({
  id: 'group',
  title: 'Focus block',
  start_time: at(9, 9).toISOString(),
  end_time: at(9, 13).toISOString(),
  is_group_event: true,
  is_task_reservation_space: true,
});
const child = makeEvent({
  id: 'child',
  title: 'Write report',
  start_time: at(9, 10).toISOString(),
  end_time: at(9, 11).toISOString(),
  parent_group_event_id: 'group',
});
const standalone = makeEvent({ id: 'standalone', title: 'Lunch', start_time: at(9, 14).toISOString(), end_time: at(9, 15).toISOString() });

describe('event group helpers', () => {
  it('strips the recurrence suffix from ids', () => {
    expect(getBaseEventId('abc-recurrence-2026-11-16')).toBe('abc');
    expect(getBaseEventId('abc')).toBe('abc');
  });

  it('finds the children of a group for a given day', () => {
    expect(getGroupChildrenForDay(group, [group, child, standalone], at(9)).map(e => e.id)).toEqual(['child']);
    expect(getGroupChildrenForDay(group, [group, child, standalone], at(10))).toEqual([]);
  });

  it('shifts the children of a recurring group instance to the instance date', () => {
    const instance = makeEvent({
      ...group,
      id: 'group-recurrence-2026-11-16',
      start_time: at(16, 9).toISOString(),
      end_time: at(16, 13).toISOString(),
    });
    const [shifted] = getChildEventsForGroupInstance(instance, [group, child]);
    expect(shifted.id).toBe('child-recurrence-2026-11-16');
    expect(new Date(shifted.start_time)).toEqual(at(16, 10));
    expect(new Date(shifted.end_time)).toEqual(at(16, 11));
  });

  it('only nests children whose group is available', () => {
    expect(isNestedGroupChild(child, [group, child])).toBe(true);
    expect(isNestedGroupChild(child, [child])).toBe(false); // group hidden -> child shown on its own
    expect(isNestedGroupChild(standalone, [group, standalone])).toBe(false);
    // a recurrence instance of the group counts as the group being present
    const instance = makeEvent({ ...group, id: 'group-recurrence-2026-11-16' });
    expect(isNestedGroupChild(child, [instance, child])).toBe(true);
  });

  it('opens a plain child as is', () => {
    expect(resolveGroupChildForEdit(child, [group, child])).toBe(child);
  });

  it('styles reservation spaces dashed and normal groups solid', () => {
    expect(getGroupEventStyle('#112233', true).borderStyle).toBe('dashed');
    expect(getGroupEventStyle('#112233', false).borderStyle).toBe('solid');
    expect(getGroupEventStyle('#112233', true).backgroundImage).toContain('repeating-linear-gradient');
    expect(getGroupEventStyle('#112233', false).backgroundImage).toBeUndefined();
  });
});

describe('CalendarDayAgenda with event groups', () => {
  const baseProps = {
    day: at(9),
    calendars: [{ id: 'cal', color: '#3366cc', name: 'Cal', isVisible: true }],
    openEditDialog: jest.fn(),
    openNewEventDialog: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('nests the child inside its group instead of listing it as a separate event', () => {
    const { container } = render(
      <CalendarDayAgenda {...baseProps} events={[group, child, standalone]} />,
    );

    const groupEl = container.querySelector('[data-event-id="group"]') as HTMLElement;
    expect(groupEl).not.toBeNull();
    expect(groupEl.style.borderStyle).toBe('dashed');
    // the child appears exactly once, inside the group
    const childMatches = screen.getAllByText('Write report');
    expect(childMatches).toHaveLength(1);
    expect(groupEl.contains(childMatches[0])).toBe(true);
    // unrelated events still render normally
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('opens the group view (not the edit dialog) when a group is clicked', () => {
    const onGroupClick = jest.fn();
    const { container } = render(
      <CalendarDayAgenda {...baseProps} events={[group, child]} onGroupClick={onGroupClick} />,
    );

    fireEvent.click(container.querySelector('[data-event-id="group"]') as HTMLElement);
    expect(onGroupClick).toHaveBeenCalledWith(group);
    expect(baseProps.openEditDialog).not.toHaveBeenCalled();
  });

  it('still opens the edit dialog for normal events', () => {
    render(<CalendarDayAgenda {...baseProps} events={[group, child, standalone]} onGroupClick={jest.fn()} />);
    fireEvent.click(screen.getByText('Lunch'));
    expect(baseProps.openEditDialog).toHaveBeenCalledWith(standalone);
  });

  it('shows a child by itself when its group is not visible', () => {
    render(<CalendarDayAgenda {...baseProps} events={[child]} />);
    expect(screen.getAllByText('Write report')).toHaveLength(1);
  });
});
