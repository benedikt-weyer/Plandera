'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import Fuse from 'fuse.js';
import { format } from 'date-fns';
import { Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/shadcn-utils';
import { useTranslation, useDateLocale } from '@/utils/context/LanguageContext';

interface CalendarSearchProps {
  events: CalendarEvent[];
  onEventSelect: (eventId: string, eventStartTime: Date) => void;
  className?: string;
}

export function CalendarSearch({ events, onEventSelect, className }: CalendarSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(events, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'location', weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [events]);

  // Perform fuzzy search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const results = fuse.search(searchQuery);
    return results.slice(0, 10).map(result => result.item);
  }, [searchQuery, fuse]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEventClick = (event: CalendarEvent) => {
    onEventSelect(event.id, new Date(event.start_time));
    setSearchQuery('');
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  const formatEventDate = (date: Date) => {
    return format(date, 'EEE, MMM d, yyyy', { locale: dateLocale });
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.all_day) {
      return t('calendar.allDay');
    }
    const start = format(new Date(event.start_time), 'p', { locale: dateLocale });
    const end = format(new Date(event.end_time), 'p', { locale: dateLocale });
    return `${start} - ${end}`;
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={t('calendar.searchEvents')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          className="pl-9 pr-4"
        />
      </div>

      {isDropdownOpen && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[400px] overflow-y-auto">
          {searchResults.map((event) => (
            <button
              key={event.id}
              onClick={() => handleEventClick(event)}
              className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0 flex items-start gap-3"
            >
              <Calendar className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{event.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatEventDate(new Date(event.start_time))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatEventTime(event)}
                </div>
                {event.location && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    📍 {event.location}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isDropdownOpen && searchQuery.trim() && searchResults.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">{t('calendar.noEventsFound')}</p>
        </div>
      )}
    </div>
  );
}
