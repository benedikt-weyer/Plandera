import {
  filterEventsForDay,
  filterEventsForMonth,
} from "@/utils/calendar/calendar";
import {
  CalendarEvent,
  RecurrenceFrequency,
} from "@/utils/calendar/calendar-types";

describe("filterEventsForMonth", () => {
  const createEvent = (overrides: Partial<CalendarEvent>): CalendarEvent =>
    ({
      id: overrides.id ?? "event-1",
      title: overrides.title ?? "Test Event",
      start_time:
        overrides.start_time ??
        new Date("2026-04-10T09:00:00.000Z").toISOString(),
      end_time:
        overrides.end_time ??
        new Date("2026-04-10T10:00:00.000Z").toISOString(),
      calendar_id: overrides.calendar_id ?? "calendar-1",
      user_id: overrides.user_id ?? "user-1",
      created_at:
        overrides.created_at ??
        new Date("2026-04-01T00:00:00.000Z").toISOString(),
      updated_at:
        overrides.updated_at ??
        new Date("2026-04-01T00:00:00.000Z").toISOString(),
      ...overrides,
    }) as CalendarEvent;

  it("returns regular events inside the visible month grid", () => {
    const events = [
      createEvent({
        id: "inside-month",
        start_time: "2026-04-12T09:00:00.000Z",
        end_time: "2026-04-12T10:00:00.000Z",
      }),
      createEvent({
        id: "outside-month",
        start_time: "2026-05-20T09:00:00.000Z",
        end_time: "2026-05-20T10:00:00.000Z",
      }),
    ];

    const result = filterEventsForMonth(
      events,
      new Date("2026-04-15T00:00:00.000Z"),
    );

    expect(result.map((event) => event.id)).toEqual(["inside-month"]);
  });

  it("includes recurring instances that fall inside the month range", () => {
    const events = [
      createEvent({
        id: "recurring-event",
        start_time: "2026-03-30T09:00:00.000Z",
        end_time: "2026-03-30T10:00:00.000Z",
        recurrence_rule: JSON.stringify({
          frequency: RecurrenceFrequency.Weekly,
          interval: 1,
        }),
      }),
    ];

    const result = filterEventsForMonth(
      events,
      new Date("2026-04-15T00:00:00.000Z"),
    );

    expect(result.map((event) => event.id)).toEqual([
      "recurring-event",
      "recurring-event-recurrence-2026-04-06",
      "recurring-event-recurrence-2026-04-13",
      "recurring-event-recurrence-2026-04-20",
      "recurring-event-recurrence-2026-04-27",
    ]);
  });
});

describe("filterEventsForDay", () => {
  const createEvent = (overrides: Partial<CalendarEvent>): CalendarEvent =>
    ({
      id: overrides.id ?? "event-1",
      title: overrides.title ?? "Test Event",
      start_time:
        overrides.start_time ??
        new Date("2026-04-10T09:00:00.000Z").toISOString(),
      end_time:
        overrides.end_time ??
        new Date("2026-04-10T10:00:00.000Z").toISOString(),
      calendar_id: overrides.calendar_id ?? "calendar-1",
      user_id: overrides.user_id ?? "user-1",
      created_at:
        overrides.created_at ??
        new Date("2026-04-01T00:00:00.000Z").toISOString(),
      updated_at:
        overrides.updated_at ??
        new Date("2026-04-01T00:00:00.000Z").toISOString(),
      ...overrides,
    }) as CalendarEvent;

  it("includes recurring instances that fall inside the selected day", () => {
    const events = [
      createEvent({
        id: "daily-event",
        start_time: "2026-04-08T09:00:00.000Z",
        end_time: "2026-04-08T10:00:00.000Z",
        recurrence_rule: JSON.stringify({
          frequency: RecurrenceFrequency.Daily,
          interval: 1,
        }),
      }),
    ];

    const result = filterEventsForDay(
      events,
      new Date("2026-04-10T00:00:00.000Z"),
    );

    expect(result.map((event) => event.id)).toEqual([
      "daily-event-recurrence-2026-04-10",
    ]);
  });
});
