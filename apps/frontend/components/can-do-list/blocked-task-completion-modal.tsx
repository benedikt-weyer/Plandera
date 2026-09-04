'use client';

import { useState } from 'react';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { getTaskCompletionChain, hasCircularDependency } from '@/utils/can-do-list/task-blocking-utils';

interface BlockedTaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: CanDoItemDecrypted | null;
  allTasks: CanDoItemDecrypted[];
  projects: ProjectDecrypted[];
  onCompleteChain: (taskIds: string[]) => Promise<void>;
}

export default function BlockedTaskCompletionModal({
  isOpen,
  onClose,
  task,
  allTasks,
  projects,
  onCompleteChain
}: BlockedTaskCompletionModalProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  if (!task) return null;

  // Check for circular dependencies
  const hasCircular = hasCircularDependency(task.id, allTasks);
  
  // Get the completion chain
  const completionChain = hasCircular ? [] : getTaskCompletionChain(task.id, allTasks);
  
  // Filter out already completed tasks and the target task itself
  const tasksToComplete = completionChain.filter(t => !t.completed);
  const blockingTasks = tasksToComplete.filter(t => t.id !== task.id);

  const handleCompleteChain = async () => {
    if (tasksToComplete.length === 0) return;
    
    setIsCompleting(true);
    try {
      const taskIds = tasksToComplete.map(t => t.id);
      await onCompleteChain(taskIds);
      onClose();
    } catch (error) {
      console.error('Error completing task chain:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'Inbox';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cannot Complete Blocked Task
          </DialogTitle>
          <DialogDescription>
            This task is blocked by other tasks that need to be completed first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasCircular ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-md">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Circular Dependency Detected</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                There is a circular dependency in the blocking relationships. Please resolve this by editing the task dependencies.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Target Task:
                </h3>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md">
                  <div className="font-medium">{task.content}</div>
                  <div className="text-sm text-muted-foreground">
                    {getProjectName(task.project_id)}
                  </div>
                </div>
              </div>

              {blockingTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Tasks that need to be completed first ({blockingTasks.length}):
                  </h3>
                  <div className="space-y-2">
                    {blockingTasks.map((blockingTask, index) => (
                      <div key={blockingTask.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 rounded-md">
                        <div className="flex items-center justify-center w-6 h-6 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{blockingTask.content}</div>
                          <div className="text-sm text-muted-foreground">
                            {getProjectName(blockingTask.project_id)}
                          </div>
                        </div>
                        {index < blockingTasks.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Complete all blocking tasks?
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      This will mark all {tasksToComplete.length} task{tasksToComplete.length === 1 ? '' : 's'} as completed in the correct order.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCompleting}>
            Cancel
          </Button>
          {!hasCircular && tasksToComplete.length > 0 && (
            <Button 
              onClick={handleCompleteChain} 
              disabled={isCompleting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCompleting ? 'Completing...' : `Complete All ${tasksToComplete.length} Task${tasksToComplete.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
