'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export type FilterType = 'all' | 'completed' | 'pending';
export type SortType = 'newest' | 'oldest' | 'alphabetical';

interface ListControlsProps {
  readonly itemCount: number;
  readonly completedCount: number;
  readonly currentFilter: FilterType;
  readonly currentSort: SortType;
  readonly onFilterChange: (filter: FilterType) => void;
  readonly onSortChange: (sort: SortType) => void;
  readonly onClearCompleted?: () => void;
}

export default function ListControls({
  itemCount,
  completedCount,
  currentFilter,
  currentSort,
  onFilterChange,
  onSortChange,
  onClearCompleted
}: ListControlsProps) {
  const pendingCount = itemCount - completedCount;

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between py-3 border-b">
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            Total: {itemCount}
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="default" className="text-xs">
              Pending: {pendingCount}
            </Badge>
          )}
          {completedCount > 0 && (
            <Badge variant="outline" className="text-xs">
              Completed: {completedCount}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={currentFilter} onValueChange={(value: FilterType) => onFilterChange(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="completed">Completed only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currentSort} onValueChange={(value: SortType) => onSortChange(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="alphabetical">A-Z</SelectItem>
          </SelectContent>
        </Select>

        {completedCount > 0 && onClearCompleted && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearCompleted}
            className="text-muted-foreground hover:text-destructive"
          >
            Clear completed
          </Button>
        )}
      </div>
    </div>
  );
}
