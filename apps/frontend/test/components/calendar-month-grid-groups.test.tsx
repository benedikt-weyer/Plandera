import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/utils/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useDateLocale: () => undefined,
}));

import { CalendarMonthGrid } from '@/components/calendar/calendar-month-grid';
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

describe('CalendarMonthGrid with event groups', () => {
  const baseProps = {
    currentDate: at(9),
    selectedDate: at(9),
    calendars: [{ id: 'cal', color: '#3366cc', name: 'Cal', isVisible: true }],
  };

  it('shows a group as one styled chip with its child count and hides the child chip', () => {
    render(
      <CalendarMonthGrid {...baseProps} events={[group, child, standalone]} openEditDialog={jest.fn()} />,
    );

    const groupChip = screen.getByText('Focus block').closest('[role="button"]') as HTMLElement;
    expect(groupChip.style.borderStyle).toBe('dashed');
    expect(groupChip).toHaveTextContent('1'); // one child
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('opens the group view when a group chip is clicked, the edit dialog for other events', () => {
    const openEditDialog = jest.fn();
    const onGroupClick = jest.fn();
    render(
      <CalendarMonthGrid
        {...baseProps}
        events={[group, child, standalone]}
        openEditDialog={openEditDialog}
        onGroupClick={onGroupClick}
      />,
    );

    fireEvent.click(screen.getByText('Focus block'));
    expect(onGroupClick).toHaveBeenCalledWith(group);
    expect(openEditDialog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Lunch'));
    expect(openEditDialog).toHaveBeenCalledWith(standalone);
  });
});
