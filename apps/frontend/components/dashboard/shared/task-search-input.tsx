'use client';

import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { useTranslation } from '@/utils/context/LanguageContext';

interface TaskSearchInputProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface TaskSearchWithFilterProps {
  tasks: CanDoItemDecrypted[];
  projects: ProjectDecrypted[];
  placeholder?: string;
  className?: string;
  onFilteredTasksChange: (filteredTasks: CanDoItemDecrypted[], isSearchActive: boolean) => void;
}

// Simple search input component (existing functionality)
export function TaskSearchInput({ 
  searchQuery, 
  onSearchChange, 
  placeholder = "Search tasks...",
  className = "w-64"
}: TaskSearchInputProps) {
  const { t } = useTranslation();
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder={t('common.search')}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-8 pr-8 h-8 text-sm"
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Advanced search component with built-in filtering logic
export function TaskSearchWithFilter({ 
  tasks,
  projects,
  placeholder = "Search tasks...",
  className = "w-64",
  onFilteredTasksChange
}: TaskSearchWithFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Configure Fuse.js for fuzzy search
  const fuseOptions = useMemo(() => ({
    keys: [
      { name: 'content', weight: 0.7 },
      { name: 'projectName', weight: 0.3 }
    ],
    threshold: 0.3, // Lower = more strict, higher = more fuzzy
    includeScore: true,
    minMatchCharLength: 1
  }), []);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      // Add project names to tasks for search
      const searchableTasks = tasks.map(task => ({
        ...task,
        projectName: task.project_id 
          ? projects.find(p => p.id === task.project_id)?.name || ''
          : 'Inbox'
      }));

      const fuse = new Fuse(searchableTasks, fuseOptions);
      const searchResults = fuse.search(searchQuery.trim());
      return { results: searchResults.map(result => result.item), isSearchActive: true };
    }

    return { results: tasks, isSearchActive: false };
  }, [tasks, projects, searchQuery, fuseOptions]);

  // Call the callback whenever filtered tasks change
  useEffect(() => {
    onFilteredTasksChange(filteredTasks.results, filteredTasks.isSearchActive);
  }, [filteredTasks, onFilteredTasksChange]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <TaskSearchInput
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
