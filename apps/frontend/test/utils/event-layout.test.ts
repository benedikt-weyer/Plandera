import { calculateEventLayout } from '@/utils/calendar/calendar-render';
import { CalendarEvent } from '@/utils/calendar/calendar-types';

describe('calculateEventLayout', () => {
  // Helper to create a test event
  const createEvent = (id: string, startHour: number, endHour: number): CalendarEvent => {
    const baseDate = new Date('2024-01-01');
    const start = new Date(baseDate);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(endHour, 0, 0, 0);

    return {
      id,
      title: `Event ${id}`,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      calendar_id: 'test-calendar',
      user_id: 'test-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as CalendarEvent;
  };

  it('should handle a single event', () => {
    const events = [createEvent('1', 9, 10)];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(1);
    expect(layouts[0].column).toBe(0);
    expect(layouts[0].columnSpan).toBe(1);
    expect(layouts[0].totalColumns).toBe(1);
  });

  it('should place non-overlapping events in the same column', () => {
    const events = [
      createEvent('1', 9, 10),
      createEvent('2', 10, 11),
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(2);
    // Both should be in column 0 since they don't overlap
    expect(layouts[0].column).toBe(0);
    expect(layouts[1].column).toBe(0);
  });

  it('should place overlapping events in different columns', () => {
    const events = [
      createEvent('1', 9, 11),
      createEvent('2', 10, 12),
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(2);
    expect(layouts[0].column).toBe(0);
    expect(layouts[1].column).toBe(1);
    expect(layouts[0].totalColumns).toBe(2);
    expect(layouts[1].totalColumns).toBe(2);
  });

  it('should maximize event width when columns are free', () => {
    // Event 1: 9-12, Event 2: 10-11, Event 3: 11-12
    // Event 1 should be in column 0
    // Event 2 should be in column 1
    // Event 3 should be in column 1 (doesn't overlap with Event 2)
    // But Event 1 should NOT span to column 1 since Event 2 overlaps with it
    const events = [
      createEvent('1', 9, 12),  // Long event
      createEvent('2', 10, 11), // Short event overlapping with 1
      createEvent('3', 11, 12), // Another short event overlapping with 1 but not with 2
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(3);
    
    const event1Layout = layouts.find(l => l.event.id === '1');
    const event2Layout = layouts.find(l => l.event.id === '2');
    const event3Layout = layouts.find(l => l.event.id === '3');

    // Event 1 should be in column 0
    expect(event1Layout?.column).toBe(0);
    // Event 1 should span only 1 column (can't expand because Event 2 overlaps)
    expect(event1Layout?.columnSpan).toBe(1);
    
    // Events 2 and 3 should be in column 1
    expect(event2Layout?.column).toBe(1);
    expect(event3Layout?.column).toBe(1);
  });

  it('should handle three parallel overlapping events', () => {
    const events = [
      createEvent('1', 9, 10),
      createEvent('2', 9, 10),
      createEvent('3', 9, 10),
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(3);
    expect(layouts[0].column).toBe(0);
    expect(layouts[1].column).toBe(1);
    expect(layouts[2].column).toBe(2);
    expect(layouts[0].totalColumns).toBe(3);
    expect(layouts[1].totalColumns).toBe(3);
    expect(layouts[2].totalColumns).toBe(3);
  });

  it('should allow event to span multiple columns when free', () => {
    // Event 1: 9-11 (column 0)
    // Event 2: 9-10 (column 1)
    // Event 3: 11-12 (column 0, but should span to column 1 since Event 2 doesn't overlap)
    const events = [
      createEvent('1', 9, 11),
      createEvent('2', 9, 10),
      createEvent('3', 11, 12),
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(3);
    
    const event1Layout = layouts.find(l => l.event.id === '1');
    const event2Layout = layouts.find(l => l.event.id === '2');
    const event3Layout = layouts.find(l => l.event.id === '3');

    expect(event1Layout?.column).toBe(0);
    expect(event2Layout?.column).toBe(1);
    expect(event3Layout?.column).toBe(0);
    
    // Event 3 should be able to span both columns since Event 2 doesn't overlap with it
    expect(event3Layout?.columnSpan).toBe(2);
  });

  it('should handle complex overlapping scenario', () => {
    // A complex case with 4 events
    // Event 1: 9-17 (should be in column 0, can't span)
    // Event 2: 10-12 (should be in column 1)
    // Event 3: 11-13 (should be in column 2)
    // Event 4: 14-16 (should be in column 1, and should span to column 2)
    const events = [
      createEvent('1', 9, 17),
      createEvent('2', 10, 12),
      createEvent('3', 11, 13),
      createEvent('4', 14, 16),
    ];
    const layouts = calculateEventLayout(events);

    expect(layouts).toHaveLength(4);
    
    const event1Layout = layouts.find(l => l.event.id === '1');
    const event2Layout = layouts.find(l => l.event.id === '2');
    const event3Layout = layouts.find(l => l.event.id === '3');
    const event4Layout = layouts.find(l => l.event.id === '4');

    expect(event1Layout?.column).toBe(0);
    expect(event2Layout?.column).toBe(1);
    expect(event3Layout?.column).toBe(2);
    expect(event4Layout?.column).toBe(1);
    
    // Event 4 should span columns 1 and 2
    expect(event4Layout?.columnSpan).toBe(2);
  });
});

