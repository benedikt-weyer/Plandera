'use client';

import { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Clock, Info, Zap, Calendar, Folder, Sun } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';
import { isValidHashtag, getLastWordBeforeCursor } from '@/utils/can-do-list/hashtag-utils';

export interface Tag {
  id: string;
  text: string;
  duration?: number; // in minutes, for duration tags
  impact?: number; // 1-10, for priority tags
  urgency?: number; // 1-10, for priority tags
  dueDate?: Date; // for due date tags
  projectId?: string; // for project tags
  projectName?: string; // for project tags
  projectColor?: string; // for project tags
  myDay?: boolean; // for my day tags
  type: 'duration' | 'priority' | 'due-date' | 'project' | 'my-day' | 'custom'; // extensible for different tag types
}

interface TaggedInputProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  onTagsChange?: (tags: Tag[]) => void;
  tags?: Tag[];
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  availableTagSuggestions?: TagSuggestion[];
  projects?: { id: string; name: string; color?: string; parent_id?: string; }[]; // for project suggestions
  autoComplete?: string;
  autoCorrect?: 'on' | 'off';
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  spellCheck?: boolean;
}

export interface TagSuggestion {
  id: string;
  text: string;
  description?: string;
  type: 'duration' | 'priority' | 'due-date' | 'project' | 'my-day' | 'custom';
  duration?: number; // for duration suggestions
  impact?: number; // for priority suggestions
  urgency?: number; // for priority suggestions
  dueDate?: Date; // for due date suggestions
  projectId?: string; // for project suggestions
  projectName?: string; // for project suggestions
  projectColor?: string; // for project suggestions
  myDay?: boolean; // for my day suggestions
}

export interface TaggedInputRef {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getTags: () => Tag[];
  setTags: (tags: Tag[]) => void;
  clearTags: () => void;
}

export const TaggedInput = forwardRef<TaggedInputRef, TaggedInputProps>(
  ({ 
    placeholder, 
    disabled, 
    className, 
    value, 
    onChange, 
    onTagsChange,
    tags: externalTags,
    onKeyDown: externalOnKeyDown,
    availableTagSuggestions = [],
    projects = [],
    ...props 
  }, ref) => {
    const [internalTags, setInternalTags] = useState<Tag[]>([]);
    const [internalValue, setInternalValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<TagSuggestion[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Use ref to track previous availableTagSuggestions to prevent unnecessary re-renders
    const prevAvailableTagSuggestionsRef = useRef<TagSuggestion[]>([]);
    const allSuggestionsRef = useRef<TagSuggestion[]>([]);

    // Use external state if provided, otherwise use internal state
    const tags = externalTags ?? internalTags;
    const inputValue = value ?? internalValue;

    // Default tag suggestions - common duration tags and overview - memoized to prevent re-renders
    const defaultSuggestions: TagSuggestion[] = useMemo(() => [
      // Overview/help suggestions
      { id: 'help-duration', text: '#d...', description: 'Duration tags - #d15m, #d1h, #d2h30m', type: 'custom' },
      { id: 'help-priority', text: '#p...', description: 'Priority tags - #p5, #i7, #u3, #i7u3', type: 'custom' },
      { id: 'help-due-date', text: '#due...', description: 'Due date tags - #due2024-12-25, #duetoday, #due4d, #duenextmonday', type: 'custom' },
      { id: 'help-project', text: '#pro', description: 'Project selection - fuzzy search your projects', type: 'custom' },
      { id: 'help-my-day', text: '#day', description: 'Add to My Day - #day', type: 'custom' },
      { id: 'help-custom', text: '#...', description: 'Custom tags - #urgent, #meeting, #personal', type: 'custom' },
      
      // Common duration tags
      { id: 'duration-15m', text: '#d15m', description: '15 minutes', type: 'duration', duration: 15 },
      { id: 'duration-30m', text: '#d30m', description: '30 minutes', type: 'duration', duration: 30 },
      { id: 'duration-1h', text: '#d1h', description: '1 hour', type: 'duration', duration: 60 },
      { id: 'duration-1h30m', text: '#d1h30m', description: '1 hour 30 minutes', type: 'duration', duration: 90 },
      { id: 'duration-2h', text: '#d2h', description: '2 hours', type: 'duration', duration: 120 },
      { id: 'duration-3h', text: '#d3h', description: '3 hours', type: 'duration', duration: 180 },
      
      // Common priority tags
      { id: 'priority-p3', text: '#p3', description: 'Priority 3', type: 'priority', impact: 3, urgency: 3 },
      { id: 'priority-p5', text: '#p5', description: 'Priority 5', type: 'priority', impact: 5, urgency: 5 },
      { id: 'priority-p7', text: '#p7', description: 'Priority 7', type: 'priority', impact: 7, urgency: 7 },
      { id: 'priority-p9', text: '#p9', description: 'Priority 9', type: 'priority', impact: 9, urgency: 9 },
      { id: 'priority-i3', text: '#i3', description: 'Impact 3', type: 'priority', impact: 3 },
      { id: 'priority-i5', text: '#i5', description: 'Impact 5', type: 'priority', impact: 5 },
      { id: 'priority-i8', text: '#i8', description: 'Impact 8', type: 'priority', impact: 8 },
      { id: 'priority-u3', text: '#u3', description: 'Urgency 3', type: 'priority', urgency: 3 },
      { id: 'priority-u5', text: '#u5', description: 'Urgency 5', type: 'priority', urgency: 5 },
      { id: 'priority-u8', text: '#u8', description: 'Urgency 8', type: 'priority', urgency: 8 },
      { id: 'priority-i8u3', text: '#i8u3', description: 'Impact 8, Urgency 3', type: 'priority', impact: 8, urgency: 3 },
      { id: 'priority-i5u7', text: '#i5u7', description: 'Impact 5, Urgency 7', type: 'priority', impact: 5, urgency: 7 },
      { id: 'priority-i9u2', text: '#i9u2', description: 'Impact 9, Urgency 2', type: 'priority', impact: 9, urgency: 2 },
      
      // Common due date tags
      { id: 'due-today', text: '#duetoday', description: 'Due today', type: 'due-date', dueDate: new Date() },
      { id: 'due-tomorrow', text: '#duetomorrow', description: 'Due tomorrow', type: 'due-date', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { id: 'due-3d', text: '#due3d', description: 'Due in 3 days', type: 'due-date', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      { id: 'due-week', text: '#dueweek', description: 'Due in 1 week', type: 'due-date', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { id: 'due-nextmonday', text: '#duenextmonday', description: 'Due next Monday', type: 'due-date', dueDate: (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7;
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + daysUntilMonday);
        return nextMonday;
      })() },
      { id: 'due-nextfriday', text: '#duenextfriday', description: 'Due next Friday', type: 'due-date', dueDate: (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        return nextFriday;
      })() },
      
      // My Day tag
      { id: 'my-day', text: '#day', description: 'Add to My Day', type: 'my-day', myDay: true },
    ], []);

    // Helper function to build hierarchical project name
    const buildProjectPath = (projectId: string, projectsMap: Map<string, typeof projects[0]>): string => {
      const path: string[] = [];
      let currentProject = projectsMap.get(projectId);
      
      while (currentProject) {
        path.unshift(currentProject.name);
        currentProject = currentProject.parent_id ? projectsMap.get(currentProject.parent_id) : undefined;
      }
      
      return path.join('/');
    };

    // Generate project suggestions from available projects
    const projectSuggestions: TagSuggestion[] = useMemo(() => {
      const projectsMap = new Map(projects.map(p => [p.id, p]));
      
      return projects.map(project => {
        const hierarchicalName = buildProjectPath(project.id, projectsMap);
        return {
          id: `project-${project.id}`,
          text: `#pro ${hierarchicalName}`,
          description: hierarchicalName,
          type: 'project' as const,
          projectId: project.id,
          projectName: hierarchicalName,
          projectColor: project.color || '#6b7280'
        };
      });
    }, [projects]);

    // Update allSuggestionsRef when needed to avoid infinite re-renders
    // Always ensure the ref has the current suggestions
    const currentSuggestionsKey = JSON.stringify(availableTagSuggestions) + JSON.stringify(projectSuggestions);
    const prevSuggestionsKey = JSON.stringify(prevAvailableTagSuggestionsRef.current);
    
    if (prevSuggestionsKey !== currentSuggestionsKey || allSuggestionsRef.current.length === 0) {
      prevAvailableTagSuggestionsRef.current = availableTagSuggestions;
      allSuggestionsRef.current = [...defaultSuggestions, ...projectSuggestions, ...availableTagSuggestions];
    }

    // Calculate dropdown position
    const updateDropdownPosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    // Update dropdown state when input changes
    useEffect(() => {
      if (!inputValue || disabled) {
        setShowDropdown(false);
        setFilteredSuggestions([]);
        setSelectedSuggestionIndex(-1);
        setDropdownPosition(null);
        return;
      }
      
      const cursorPosition = inputRef.current?.selectionStart ?? inputValue.length;
      const textBeforeCursor = inputValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      const shouldShow = lastWord.startsWith('#') && lastWord.length >= 1;
      
      if (!shouldShow) {
        setShowDropdown(false);
        setFilteredSuggestions([]);
        setSelectedSuggestionIndex(-1);
        return;
      }
      
      // Get current suggestions from ref to avoid stale closures
      const currentSuggestions = allSuggestionsRef.current;
      
      // If it's just a hashtag, show all suggestions (overview)
      if (lastWord === '#') {
        updateDropdownPosition();
        setShowDropdown(true);
        setFilteredSuggestions(currentSuggestions);
        setSelectedSuggestionIndex(-1);
        return;
      }
      
      // Special handling for #pro - show project search
      if (lastWord.toLowerCase().startsWith('#pro')) {
        const searchTerm = lastWord.slice(4).trim(); // Remove '#pro' and trim
        
        if (searchTerm === '') {
          // Show all projects when just '#pro' is typed
          const projectSugs = currentSuggestions.filter(s => s.type === 'project');
          if (projectSugs.length > 0) {
            updateDropdownPosition();
            setShowDropdown(true);
            setFilteredSuggestions(projectSugs);
            setSelectedSuggestionIndex(-1);
          } else {
            setShowDropdown(false);
          }
          return;
        } else {
          // Fuzzy search projects - search both project name and description (hierarchical path)
          const projectSugs = currentSuggestions.filter(s => s.type === 'project');
          const fuzzyFiltered = projectSugs.filter(suggestion => 
            suggestion.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            suggestion.description?.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          if (fuzzyFiltered.length > 0) {
            updateDropdownPosition();
            setShowDropdown(true);
            setFilteredSuggestions(fuzzyFiltered);
            setSelectedSuggestionIndex(-1);
          } else {
            setShowDropdown(false);
          }
          return;
        }
      }
      
      // Filter suggestions based on what the user typed
      const filtered = currentSuggestions.filter(suggestion => 
        suggestion.text.toLowerCase().startsWith(lastWord.toLowerCase())
      );
      
      if (filtered.length > 0) {
        updateDropdownPosition();
        setShowDropdown(true);
        setFilteredSuggestions(filtered);
        setSelectedSuggestionIndex(-1);
      } else {
        setShowDropdown(false);
      }
    }, [inputValue, disabled]); // Only depend on inputValue and disabled

    // Handle clicks outside dropdown to close it
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
            inputRef.current && !inputRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectSuggestion = (suggestion: TagSuggestion) => {
      // Don't select help/overview suggestions
      if (suggestion.id.startsWith('help-')) {
        return;
      }
      
      const cursorPosition = inputRef.current?.selectionStart ?? inputValue.length;
      const textBeforeCursor = inputValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      const afterCursor = inputValue.slice(cursorPosition);
      
      // Find the start position of the hashtag word
      const hashtagStartPos = cursorPosition - lastWord.length;
      const beforeHashtag = inputValue.slice(0, hashtagStartPos);
      
      // Remove the hashtag entirely and clean up spacing
      let newValue = beforeHashtag.trimEnd();
      if (afterCursor.trim()) {
        newValue += (newValue ? ' ' : '') + afterCursor.trimStart();
      }
      
      setValue(newValue);
      
      // Create the tag
      const newTag: Tag = {
        id: Date.now().toString(),
        text: suggestion.type === 'project' ? `#pro ${suggestion.projectName}` : suggestion.text,
        duration: suggestion.duration,
        impact: suggestion.impact,
        urgency: suggestion.urgency,
        dueDate: suggestion.dueDate,
        projectId: suggestion.projectId,
        projectName: suggestion.projectName,
        projectColor: suggestion.projectColor,
        myDay: suggestion.myDay,
        type: suggestion.type
      };
      
      // Update tags state - override existing duration/priority/due-date/project/my-day tag if it's a duration/priority/due-date/project/my-day type
      setTags(prev => {
        if (suggestion.type === 'duration') {
          const filteredTags = prev.filter(tag => tag.type !== 'duration');
          return [...filteredTags, newTag];
        } else if (suggestion.type === 'priority') {
          const filteredTags = prev.filter(tag => tag.type !== 'priority');
          return [...filteredTags, newTag];
        } else if (suggestion.type === 'due-date') {
          const filteredTags = prev.filter(tag => tag.type !== 'due-date');
          return [...filteredTags, newTag];
        } else if (suggestion.type === 'project') {
          const filteredTags = prev.filter(tag => tag.type !== 'project');
          return [...filteredTags, newTag];
        } else if (suggestion.type === 'my-day') {
          const filteredTags = prev.filter(tag => tag.type !== 'my-day');
          return [...filteredTags, newTag];
        } else {
          return [...prev, newTag];
        }
      });
      
      setShowDropdown(false);
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = newValue.length - (afterCursor.trim() ? afterCursor.trimStart().length : 0);
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    };

    const setTags = (newTags: Tag[] | ((prev: Tag[]) => Tag[])) => {
      const updatedTags = typeof newTags === 'function' ? newTags(tags) : newTags;
      if (onTagsChange) {
        onTagsChange(updatedTags);
      } else {
        setInternalTags(updatedTags);
      }
    };

    const setValue = (newValue: string) => {
      if (onChange) {
        onChange(newValue);
      } else {
        setInternalValue(newValue);
      }
    };

    // Format duration for display
    const formatDuration = (minutes?: number): string => {
      if (!minutes) return '0m';
      if (minutes < 60) {
        return `${minutes}m`;
      }
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Parse duration hashtags similar to the existing parser
    const parseDurationTag = (text: string): { duration: number; displayText: string } | null => {
      const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/i;
      const match = durationRegex.exec(text);
      
      if (!match) return null;
      
      const timeString = match[1];
      const duration = parseTimeString(timeString);
      
      if (duration === null) return null;
      
      return {
        duration,
        displayText: formatDuration(duration)
      };
    };

    // Parse priority hashtags
    const parsePriorityTag = (text: string): { impact?: number; urgency?: number; displayText: string } | null => {
      // Parse combined format: #i7u3 (impact 7, urgency 3)
      const combinedRegex = /#i(\d)u(\d)/i;
      const combinedMatch = combinedRegex.exec(text);
      
      if (combinedMatch) {
        const impact = parseInt(combinedMatch[1], 10);
        const urgency = parseInt(combinedMatch[2], 10);
        
        if (impact >= 1 && impact <= 10 && urgency >= 1 && urgency <= 10) {
          // If both values are provided, take the average
          const priority = Math.round((impact + urgency) / 2);
          return {
            impact,
            urgency,
            displayText: `P${priority}`
          };
        }
      }

      // Parse impact only format: #i7
      const impactRegex = /#i(\d)/i;
      const impactMatch = impactRegex.exec(text);
      
      if (impactMatch) {
        const impact = parseInt(impactMatch[1], 10);
        
        if (impact >= 1 && impact <= 10) {
          return {
            impact,
            displayText: `P${impact}`
          };
        }
      }

      // Parse urgency only format: #u5
      const urgencyRegex = /#u(\d)/i;
      const urgencyMatch = urgencyRegex.exec(text);
      
      if (urgencyMatch) {
        const urgency = parseInt(urgencyMatch[1], 10);
        
        if (urgency >= 1 && urgency <= 10) {
          return {
            urgency,
            displayText: `P${urgency}`
          };
        }
      }

      // Parse simple priority format: #p5 (sets both impact and urgency to 5)
      const priorityRegex = /#p(\d)/i;
      const priorityMatch = priorityRegex.exec(text);
      
      if (priorityMatch) {
        const priority = parseInt(priorityMatch[1], 10);
        
        if (priority >= 1 && priority <= 10) {
          return {
            impact: priority,
            urgency: priority,
            displayText: `P${priority}`
          };
        }
      }

      return null;
    };

    // Parse due date hashtags
    const parseDueDateTag = (text: string): { dueDate: Date; displayText: string } | null => {
      // Parse specific date format: #due2024-12-25
      const dateRegex = /#due(\d{4}-\d{2}-\d{2})/i;
      const dateMatch = dateRegex.exec(text);
      
      if (dateMatch) {
        const dateString = dateMatch[1];
        const date = new Date(dateString + 'T00:00:00.000Z');
        
        if (!isNaN(date.getTime())) {
          return {
            dueDate: date,
            displayText: formatDueDate(date)
          };
        }
      }

      // Parse relative date formats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (text.toLowerCase() === '#duetoday') {
        return {
          dueDate: today,
          displayText: 'Today'
        };
      }
      
      if (text.toLowerCase() === '#duetomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return {
          dueDate: tomorrow,
          displayText: 'Tomorrow'
        };
      }
      
      if (text.toLowerCase() === '#dueweek') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return {
          dueDate: nextWeek,
          displayText: 'Next week'
        };
      }

      // Parse days offset format: #due4d (4 days from now)
      const daysRegex = /#due(\d+)d/i;
      const daysMatch = daysRegex.exec(text);
      
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + days);
        return {
          dueDate: targetDate,
          displayText: days === 1 ? 'Tomorrow' : `In ${days} days`
        };
      }

      // Parse named weekday formats: #duenextmonday, #duemonday (next occurrence)
      const weekdayRegex = /#due(?:next)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
      const weekdayMatch = weekdayRegex.exec(text);
      
      if (weekdayMatch) {
        const weekdayName = weekdayMatch[1].toLowerCase();
        const weekdayMap: { [key: string]: number } = {
          'sunday': 0,
          'monday': 1,
          'tuesday': 2,
          'wednesday': 3,
          'thursday': 4,
          'friday': 5,
          'saturday': 6
        };
        
        const targetWeekday = weekdayMap[weekdayName];
        const currentWeekday = today.getDay();
        
        // Calculate days until next occurrence of the target weekday
        let daysUntil = targetWeekday - currentWeekday;
        if (daysUntil <= 0) {
          daysUntil += 7; // Go to next week if target day has passed or is today
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        
        const weekdayDisplayName = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
        return {
          dueDate: targetDate,
          displayText: daysUntil === 1 ? 'Tomorrow' : `Next ${weekdayDisplayName}`
        };
      }

      return null;
    };

    // Format due date for display
    const formatDueDate = (date: Date): string => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
      if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
      
      // For dates further away, show the actual date
      return date.toLocaleDateString();
    };

    // Parse time string to minutes
    const parseTimeString = (timeString: string): number | null => {
      // Handle pure minutes: "15" or "15m"
      const minutesOnlyRegex = /^(\d+)m?$/;
      const minutesOnlyMatch = minutesOnlyRegex.exec(timeString);
      if (minutesOnlyMatch) {
        return parseInt(minutesOnlyMatch[1], 10);
      }
      
      // Handle hours only: "1h"
      const hoursOnlyRegex = /^(\d+)h$/;
      const hoursOnlyMatch = hoursOnlyRegex.exec(timeString);
      if (hoursOnlyMatch) {
        return parseInt(hoursOnlyMatch[1], 10) * 60;
      }
      
      // Handle hours and minutes: "1h15m" or "1h15"
      const hoursMinutesRegex = /^(\d+)h(\d+)m?$/;
      const hoursMinutesMatch = hoursMinutesRegex.exec(timeString);
      if (hoursMinutesMatch) {
        const hours = parseInt(hoursMinutesMatch[1], 10);
        const minutes = parseInt(hoursMinutesMatch[2], 10);
        return hours * 60 + minutes;
      }
      
      return null;
    };

    const handleDropdownNavigation = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
      if (!showDropdown || filteredSuggestions.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => {
          let next = prev < filteredSuggestions.length - 1 ? prev + 1 : 0;
          // Skip help suggestions when navigating
          while (filteredSuggestions[next]?.id.startsWith('help-') && next !== prev) {
            next = next < filteredSuggestions.length - 1 ? next + 1 : 0;
          }
          return next;
        });
        return true;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => {
          let next = prev > 0 ? prev - 1 : filteredSuggestions.length - 1;
          // Skip help suggestions when navigating
          while (filteredSuggestions[next]?.id.startsWith('help-') && next !== prev) {
            next = next > 0 ? next - 1 : filteredSuggestions.length - 1;
          }
          return next;
        });
        return true;
      }
      
      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
        return true;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
        return true;
      }

      return false;
    };

    const handleSpaceKeyForTags = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const currentValue = inputValue;
      const cursorPosition = inputRef.current?.selectionStart ?? 0;
      
      // Get the word before the cursor
      const textBeforeCursor = currentValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      // Check for duration hashtag first
      const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/i;
      const durationMatch = durationRegex.exec(lastWord);
      
      if (durationMatch) {
        const hashtagText = durationMatch[0]; // The full hashtag match (e.g., "#d15m")
        const parsedTag = parseDurationTag(hashtagText);
        
        if (parsedTag) {
          e.preventDefault();
          
          // Create a new duration tag
          const newTag: Tag = {
            id: Date.now().toString(),
            text: hashtagText,
            duration: parsedTag.duration,
            type: 'duration'
          };
          
          // Update tags state - override existing duration tag
          setTags(prev => {
            // Remove any existing duration tags and add the new one
            const filteredTags = prev.filter(tag => tag.type !== 'duration');
            return [...filteredTags, newTag];
          });
          
          // Remove only the hashtag portion from the input and add a space
          const hashtagStartPos = cursorPosition - lastWord.length + lastWord.indexOf(hashtagText);
          const beforeHashtag = currentValue.slice(0, hashtagStartPos);
          const afterCursor = currentValue.slice(cursorPosition);
          const newValue = beforeHashtag + ' ' + afterCursor;
          setValue(newValue);
          
          // Focus the input and set cursor position
          setTimeout(() => {
            if (inputRef.current) {
              const newCursorPos = hashtagStartPos + 1;
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
              inputRef.current.focus();
            }
          }, 0);
          return;
        }
      }

      // Check for priority hashtag
      const priorityRegex = /#(?:p(\d)|i(\d)u(\d)|i(\d)|u(\d))/i;
      const priorityMatch = priorityRegex.exec(lastWord);
      
      if (priorityMatch) {
        const hashtagText = priorityMatch[0]; // The full hashtag match (e.g., "#p5" or "#i7u3")
        const parsedTag = parsePriorityTag(hashtagText);
        
        if (parsedTag) {
          e.preventDefault();
          
          // Create a new priority tag
          const newTag: Tag = {
            id: Date.now().toString(),
            text: hashtagText,
            impact: parsedTag.impact,
            urgency: parsedTag.urgency,
            type: 'priority'
          };
          
          // Update tags state - override existing priority tag
          setTags(prev => {
            // Remove any existing priority tags and add the new one
            const filteredTags = prev.filter(tag => tag.type !== 'priority');
            return [...filteredTags, newTag];
          });
          
          // Remove only the hashtag portion from the input and add a space
          const hashtagStartPos = cursorPosition - lastWord.length + lastWord.indexOf(hashtagText);
          const beforeHashtag = currentValue.slice(0, hashtagStartPos);
          const afterCursor = currentValue.slice(cursorPosition);
          const newValue = beforeHashtag + ' ' + afterCursor;
          setValue(newValue);
          
          // Focus the input and set cursor position
          setTimeout(() => {
            if (inputRef.current) {
              const newCursorPos = hashtagStartPos + 1;
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
              inputRef.current.focus();
            }
          }, 0);
          return;
        }
      }

      // Check for due date hashtag
      const dueDateRegex = /#(?:due\d{4}-\d{2}-\d{2}|due\d+d|duetoday|duetomorrow|dueweek|due(?:next)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i;
      const dueDateMatch = dueDateRegex.exec(lastWord);
      
      if (dueDateMatch) {
        const hashtagText = dueDateMatch[0]; // The full hashtag match (e.g., "#due2024-12-25" or "#duetoday")
        const parsedTag = parseDueDateTag(hashtagText);
        
        if (parsedTag) {
          e.preventDefault();
          
          // Create a new due date tag
          const newTag: Tag = {
            id: Date.now().toString(),
            text: hashtagText,
            dueDate: parsedTag.dueDate,
            type: 'due-date'
          };
          
          // Update tags state - override existing due date tag
          setTags(prev => {
            // Remove any existing due date tags and add the new one
            const filteredTags = prev.filter(tag => tag.type !== 'due-date');
            return [...filteredTags, newTag];
          });
          
          // Remove only the hashtag portion from the input and add a space
          const hashtagStartPos = cursorPosition - lastWord.length + lastWord.indexOf(hashtagText);
          const beforeHashtag = currentValue.slice(0, hashtagStartPos);
          const afterCursor = currentValue.slice(cursorPosition);
          const newValue = beforeHashtag + ' ' + afterCursor;
          setValue(newValue);
          
          // Focus the input and set cursor position
          setTimeout(() => {
            if (inputRef.current) {
              const newCursorPos = hashtagStartPos + 1;
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
              inputRef.current.focus();
            }
          }, 0);
          return;
        }
      }

      // Check for my day hashtag
      const myDayRegex = /#day/i;
      const myDayMatch = myDayRegex.exec(lastWord);
      
      if (myDayMatch) {
        const hashtagText = myDayMatch[0]; // The full hashtag match (e.g., "#day")
        
        e.preventDefault();
        
        // Create a new my day tag
        const newTag: Tag = {
          id: Date.now().toString(),
          text: hashtagText,
          myDay: true,
          type: 'my-day'
        };
        
        // Update tags state - override existing my day tag
        setTags(prev => {
          // Remove any existing my day tags and add the new one
          const filteredTags = prev.filter(tag => tag.type !== 'my-day');
          return [...filteredTags, newTag];
        });
        
        // Remove only the hashtag portion from the input and add a space
        const hashtagStartPos = cursorPosition - lastWord.length + lastWord.indexOf(hashtagText);
        const beforeHashtag = currentValue.slice(0, hashtagStartPos);
        const afterCursor = currentValue.slice(cursorPosition);
        const newValue = beforeHashtag + ' ' + afterCursor;
        setValue(newValue);
        
        // Focus the input and set cursor position
        setTimeout(() => {
          if (inputRef.current) {
            const newCursorPos = hashtagStartPos + 1;
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            inputRef.current.focus();
          }
        }, 0);
        return;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle dropdown navigation first (before external handler)
      if (handleDropdownNavigation(e)) return;

      // Check if Enter key should create a tag instead of submitting
      if (e.key === 'Enter' && !showDropdown) {
        const cursorPosition = inputRef.current?.selectionStart ?? 0;
        const lastWord = getLastWordBeforeCursor(inputValue, cursorPosition);
        
        if (isValidHashtag(lastWord)) {
          // Process the hashtag instead of submitting
          handleSpaceKeyForTags(e);
          return; // Don't call external handler, preventing form submission
        }
      }
      
      // Call external onKeyDown if we didn't handle Enter above
      externalOnKeyDown?.(e);
      
      if (e.defaultPrevented) return;

      // Handle space key for hashtags
      if (e.key === ' ') {
        handleSpaceKeyForTags(e);
      }
    };

    const removeTag = (tagId: string) => {
      setTags(prev => prev.filter(tag => tag.id !== tagId));
    };

    // Expose methods through ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => inputValue,
      setValue,
      getTags: () => tags,
      setTags: (newTags: Tag[]) => setTags(newTags),
      clearTags: () => setTags([])
    }));

    return (
      <div className={cn("relative", className)}>
        {/* Input field */}
        <Input
          {...props}
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        
        {/* Dropdown suggestions - rendered as portal */}
        {showDropdown && filteredSuggestions.length > 0 && dropdownPosition && typeof window !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[99999] bg-popover border border-border rounded-md shadow-xl max-h-48 overflow-y-auto"
            style={{ 
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 99999 
            }}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                  selectedSuggestionIndex === index && "bg-accent text-accent-foreground",
                  suggestion.id.startsWith('help-') && "bg-muted/50 cursor-default hover:bg-muted/50"
                )}
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="flex items-center gap-2">
                  {suggestion.id.startsWith('help-') && (
                    <Info className="h-3 w-3 text-muted-foreground" />
                  )}
                  {!suggestion.id.startsWith('help-') && suggestion.type === 'duration' && (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {!suggestion.id.startsWith('help-') && suggestion.type === 'due-date' && (
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                  )}
                  {!suggestion.id.startsWith('help-') && suggestion.type === 'project' && (
                    <div className="flex items-center gap-1">
                      <div 
                        className="h-3 w-3 rounded-full border border-gray-300"
                        style={{ backgroundColor: suggestion.projectColor || '#6b7280' }}
                      />
                      <Folder className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  {!suggestion.id.startsWith('help-') && suggestion.type === 'my-day' && (
                    <Sun className="h-3 w-3 text-amber-500" />
                  )}
                  <span className={cn(
                    "font-mono text-sm",
                    suggestion.id.startsWith('help-') && "text-muted-foreground font-normal"
                  )}>
                    {suggestion.text}
                  </span>
                </div>
                {suggestion.description && (
                  <span className={cn(
                    "text-xs text-muted-foreground",
                    suggestion.id.startsWith('help-') && "font-medium"
                  )}>
                    {suggestion.description}
                  </span>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
        
        {/* Tags display - reserved space at bottom */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {tags.map(tag => {
              // Get color for different tag types
              const getTagColor = () => {
                if (tag.type === 'priority' && tag.urgency) {
                  if (tag.urgency <= 3) return 'bg-green-100 text-green-700';
                  if (tag.urgency <= 6) return 'bg-yellow-100 text-yellow-700';
                  if (tag.urgency <= 8) return 'bg-orange-100 text-orange-700';
                  return 'bg-red-100 text-red-700';
                } else if (tag.type === 'due-date' && tag.dueDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const targetDate = new Date(tag.dueDate);
                  targetDate.setHours(0, 0, 0, 0);
                  
                  const diffTime = targetDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays < 0) return 'bg-red-100 text-red-700'; // Overdue
                  if (diffDays === 0) return 'bg-orange-100 text-orange-700'; // Due today
                  if (diffDays === 1) return 'bg-yellow-100 text-yellow-700'; // Due tomorrow
                  if (diffDays <= 7) return 'bg-blue-100 text-blue-700'; // Due this week
                  
                  return 'bg-gray-100 text-gray-700'; // Due later
                }
                return 'bg-secondary text-secondary-foreground';
              };

              const getTagDisplayText = () => {
                if (tag.type === 'duration') {
                  return formatDuration(tag.duration);
                } else if (tag.type === 'priority') {
                  const imp = tag.impact || 0;
                  const urg = tag.urgency || 0;
                  
                  // If both values are provided, take the average
                  if (imp > 0 && urg > 0) {
                    const priority = Math.round((imp + urg) / 2);
                    return `P${priority}`;
                  }
                  
                  // If only one value is provided, use that value directly
                  const priority = imp > 0 ? imp : urg;
                  return `P${priority}`;
                } else if (tag.type === 'due-date') {
                  return formatDueDate(tag.dueDate!);
                } else if (tag.type === 'project') {
                  return tag.projectName || tag.text;
                } else if (tag.type === 'my-day') {
                  return 'My Day';
                }
                return tag.text;
              };

              return (
                <Badge
                  key={tag.id}
                  className={cn(
                    "flex items-center gap-1 text-xs border-0",
                    getTagColor()
                  )}
                >
                  {tag.type === 'duration' && <Clock className="h-3 w-3" />}
                  {tag.type === 'priority' && <Zap className="h-3 w-3" />}
                  {tag.type === 'due-date' && <Calendar className="h-3 w-3" />}
                  {tag.type === 'project' && (
                    <div className="flex items-center gap-1">
                      <div 
                        className="h-3 w-3 rounded-full border border-gray-300"
                        style={{ backgroundColor: tag.projectColor || '#6b7280' }}
                      />
                      <Folder className="h-3 w-3" />
                    </div>
                  )}
                  {tag.type === 'my-day' && <Sun className="h-3 w-3 text-amber-500" />}
                  {getTagDisplayText()}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

TaggedInput.displayName = 'TaggedInput';
