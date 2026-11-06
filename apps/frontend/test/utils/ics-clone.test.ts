import {
  createEventCloneDraft,
  getWritableCalendars,
  pickWritableCalendarId,
} from '@/utils/calendar/ics-clone';
import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';

const makeCalendar = (id: string, type?: 'regular' | 'ics'): Calendar => ({
  id,
  name: id,
  color: '#3366cc',
  is_visible: true,
  type,
  created_at: '',
  updated_at: '',
  user_id: 'u',
});

const icsEvent: CalendarEvent = {
  id: 'ics-ics-cal-uid-1-recurrence-2026-11-16',
  title: 'Team sync',
  description: 'Weekly',
  location: 'Room 1',
  start_time: new Date(2026, 10, 16, 10).toISOString(),
  end_time: new Date(2026, 10, 16, 11).toISOString(),
  all_day: false,
  calendar_id: 'ics-cal',
  recurrence_rule: 'FREQ=WEEKLY',
  created_at: '2020-01-01T00:00:00.000Z',
  updated_at: '2020-01-01T00:00:00.000Z',
  user_id: '',
};

describe('ICS clone helpers', () => {
  const calendars = [makeCalendar('ics-cal', 'ics'), makeCalendar('work', 'regular'), makeCalendar('private')];

  it('only offers writable (non-ICS) calendars', () => {
    expect(getWritableCalendars(calendars).map(c => c.id)).toEqual(['work', 'private']);
  });

  it('preselects the preferred calendar if it is writable, else the first writable one', () => {
    expect(pickWritableCalendarId(calendars, 'private')).toBe('private');
    expect(pickWritableCalendarId(calendars, 'ics-cal')).toBe('work'); // ICS calendar is never a target
    expect(pickWritableCalendarId(calendars)).toBe('work');
  });

  it('has no target when there is only an ICS calendar', () => {
    expect(pickWritableCalendarId([makeCalendar('ics-cal', 'ics')], 'ics-cal')).toBeUndefined();
  });

  it('creates an unsaved copy of the event in the chosen calendar', () => {
    const now = new Date(2026, 10, 7, 12);
    const draft = createEventCloneDraft(icsEvent, 'work', now);

    expect(draft.id).toBe('new');
    expect(draft.calendar_id).toBe('work');
    expect(draft.created_at).toBe(now.toISOString());
    expect(draft.title).toBe('Team sync');
    expect(draft.description).toBe('Weekly');
    expect(draft.location).toBe('Room 1');
    expect(draft.start_time).toBe(icsEvent.start_time);
    expect(draft.end_time).toBe(icsEvent.end_time);
    expect(draft.recurrence_rule).toBe('FREQ=WEEKLY');
    expect(icsEvent.id).toContain('ics-'); // original is untouched
  });
});
