'use client';

/**
 * Task Drag Preview Component
 * Shows a visual preview of the task being dragged to the calendar
 */

import { useFlexyDND } from '@/lib/flexyDND';
import { Clock } from 'lucide-react';

export function TaskDragPreview() {
  const { isDragging, currentDragData, dragPosition } = useFlexyDND();

  if (!isDragging || !currentDragData || currentDragData.type !== 'task' || !dragPosition) {
    return null;
  }

  const task = currentDragData.data.task;
  const durationMinutes = currentDragData.data.durationMinutes || 60;

  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: dragPosition.x + 10,
        top: dragPosition.y + 10,
      }}
    >
      <div className="bg-primary text-primary-foreground px-3 py-2 rounded-md shadow-lg border-2 border-primary-foreground/20 min-w-[200px] max-w-[300px]">
        <div className="font-medium truncate">{task.content}</div>
        <div className="text-xs opacity-90 flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {formatDuration(durationMinutes)}
        </div>
      </div>
    </div>
  );
}

