import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/utils/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useDateLocale: () => undefined,
}));

// jsdom has no ResizeObserver, which the Radix dialog/select primitives use
(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { CalendarEventDialog } from '@/components/calendar/calendar-event-dialog';
import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';

const calendar: Calendar = {
  id: 'cal',
  name: 'Cal',
  color: '#3366cc',
  is_visible: true,
  is_default: true,
  created_at: '',
  updated_at: '',
  user_id: 'u',
};

const event: CalendarEvent = {
  id: 'e1',
  title: 'Planning',
  start_time: new Date(2026, 10, 9, 10, 0).toISOString(),
  end_time: new Date(2026, 10, 9, 11, 0).toISOString(),
  all_day: false,
  calendar_id: 'cal',
  created_at: '',
  updated_at: '',
  user_id: 'u',
};

function renderDialog(selectedEvent: CalendarEvent, onSubmit = jest.fn().mockResolvedValue(undefined)) {
  render(
    <CalendarEventDialog
      isOpen
      onOpenChange={jest.fn()}
      selectedEvent={selectedEvent}
      calendars={[calendar]}
      onSubmit={onSubmit}
      onDelete={jest.fn()}
      onClone={jest.fn()}
    />,
  );
  return onSubmit;
}

describe('CalendarEventDialog week shift buttons', () => {
  it('moves start and end one week forward and back, keeping the times', async () => {
    const onSubmit = renderDialog(event);

    fireEvent.click(screen.getByText('calendar.moveWeekForward'));
    fireEvent.click(screen.getByText('calendar.moveWeekForward'));
    fireEvent.click(screen.getByText('calendar.moveWeekBack'));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.startDate).toBe('2026-11-16');
    expect(values.endDate).toBe('2026-11-16');
    expect(values.startTime).toBe('10:00');
    expect(values.endTime).toBe('11:00');
  });

  it('moves a multi-day event as a whole', async () => {
    const onSubmit = renderDialog({ ...event, end_time: new Date(2026, 10, 11, 11, 0).toISOString() });

    fireEvent.click(screen.getByText('calendar.moveWeekBack'));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.startDate).toBe('2026-11-02');
    expect(values.endDate).toBe('2026-11-04');
  });
});
