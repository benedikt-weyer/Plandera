import { create } from 'zustand';

interface CalendarState {
  // Current week being displayed (stored as timestamp for serialization safety)
  currentWeekTimestamp: number | null;
  
  // Event highlighting
  highlightedEventId: string | null;
  
  // Getters
  getCurrentWeek: () => Date | null;
  
  // Actions
  setCurrentWeek: (week: Date) => void;
  navigateToEvent: (eventId: string, eventStartTime: Date, weekStartsOn: number) => void;
  setHighlightedEvent: (eventId: string | null) => void;
}

export const useCalendar = create<CalendarState>((set, get) => ({
  // State
  currentWeekTimestamp: null,
  highlightedEventId: null,
  
  // Getters
  getCurrentWeek: () => {
    const timestamp = get().currentWeekTimestamp;
    return timestamp ? new Date(timestamp) : null;
  },
  
  // Actions
  setCurrentWeek: (week: Date) => {
    // Ensure we have a proper Date object
    const dateObj = week instanceof Date ? week : new Date(week);
    set({ currentWeekTimestamp: dateObj.getTime() });
  },
  
  navigateToEvent: (eventId: string, eventStartTime: Date, weekStartsOn: number) => {
    // Calculate the week that contains this event
    const eventDate = new Date(eventStartTime);
    const day = eventDate.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    const weekStart = new Date(eventDate);
    weekStart.setDate(eventDate.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    
    set({ 
      currentWeekTimestamp: weekStart.getTime(),
      highlightedEventId: eventId 
    });
    
    // Clear highlight after 2 seconds
    setTimeout(() => {
      set({ highlightedEventId: null });
    }, 2000);
  },
  
  setHighlightedEvent: (eventId: string | null) => {
    set({ highlightedEventId: eventId });
  },
}));
