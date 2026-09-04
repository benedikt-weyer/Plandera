/**
 * Utility functions for calculating task recommendations
 */

import { CanDoItemDecrypted } from '../api/types';

/**
 * Calculate a recommendation score for a task based on impact, urgency, due date, and blocking relationships
 * Higher scores indicate higher priority tasks that should be recommended
 * Uses actual impact and urgency values from tasks (0-10 scale each), with 0 if not set by user
 */
export function calculateRecommendationScore(task: CanDoItemDecrypted, allTasks: CanDoItemDecrypted[]): number {
  let score = 0;
  
  // Base score from impact and urgency (0-10 each, max 20)
  // Use actual values from the task, with 0 if not set (user hasn't specified priority)
  const impact = task.impact ?? 0; // Default to 0 if not set by user
  const urgency = task.urgency ?? 0; // Default to 0 if not set by user
  score += impact + urgency;
  
  // Due date multiplier (adds urgency based on how soon the task is due)
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // Overdue tasks get maximum bonus
      score += 15;
    } else if (diffDays === 0) {
      // Due today gets high bonus
      score += 12;
    } else if (diffDays === 1) {
      // Due tomorrow gets medium bonus
      score += 8;
    } else if (diffDays <= 3) {
      // Due within 3 days gets small bonus
      score += 5;
    } else if (diffDays <= 7) {
      // Due within a week gets minimal bonus
      score += 2;
    }
    // Tasks due later get no bonus
  }
  
  // Blocking task bonus: if this task blocks other important tasks, boost its score
  const blockedTasks = allTasks.filter(t => t.blocked_by === task.id && !t.completed);
  if (blockedTasks.length > 0) {
    // Calculate the highest score among blocked tasks
    const maxBlockedScore = Math.max(...blockedTasks.map(blockedTask => {
      // Calculate blocked task's base score (without blocking bonus to avoid recursion)
      const blockedImpact = blockedTask.impact ?? 0; // Use actual impact or 0 if not set
      const blockedUrgency = blockedTask.urgency ?? 0; // Use actual urgency or 0 if not set
      let blockedScore = blockedImpact + blockedUrgency;
      
      // Add due date bonus for blocked task
      if (blockedTask.due_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(blockedTask.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) blockedScore += 15;
        else if (diffDays === 0) blockedScore += 12;
        else if (diffDays === 1) blockedScore += 8;
        else if (diffDays <= 3) blockedScore += 5;
        else if (diffDays <= 7) blockedScore += 2;
      }
      
      return blockedScore;
    }));
    
    // Add blocking bonus: ensure blocking task ranks higher than blocked task
    // Add the max blocked score + 5 to guarantee higher ranking
    score += maxBlockedScore + 5;
  }
  
  return score;
}

/**
 * Get recommended tasks sorted by recommendation score
 * @param tasks - All tasks to consider
 * @param limit - Maximum number of tasks to return (default: 20)
 * @returns Top recommended tasks sorted by score (highest first)
 */
export function getRecommendedTasks(tasks: CanDoItemDecrypted[], limit: number = 20): CanDoItemDecrypted[] {
  // Only consider active (non-completed) tasks
  const activeTasks = tasks.filter(task => !task.completed);
  
  // Calculate scores and sort
  const tasksWithScores = activeTasks.map(task => ({
    task,
    score: calculateRecommendationScore(task, tasks)
  }));
  
  // Sort by score (highest first), then by creation date (newest first) as tiebreaker
  tasksWithScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.task.created_at).getTime() - new Date(a.task.created_at).getTime();
  });
  
  // Return top tasks up to the limit
  return tasksWithScores.slice(0, limit).map(item => item.task);
}

/**
 * Get a human-readable explanation of why a task is recommended
 */
export function getRecommendationReason(task: CanDoItemDecrypted, allTasks: CanDoItemDecrypted[]): string {
  const impact = task.impact ?? 0; // Use actual impact or 0 if not set
  const urgency = task.urgency ?? 0; // Use actual urgency or 0 if not set
  const reasons: string[] = [];
  
  // Check if this task blocks important tasks
  const blockedTasks = allTasks.filter(t => t.blocked_by === task.id && !t.completed);
  if (blockedTasks.length > 0) {
    const highImpactBlocked = blockedTasks.some(t => (t.impact ?? 0) >= 8);
    const highUrgencyBlocked = blockedTasks.some(t => (t.urgency ?? 0) >= 8);
    const overdueTasks = blockedTasks.filter(t => {
      if (!t.due_date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() < today.getTime();
    });
    
    if (highImpactBlocked || highUrgencyBlocked) {
      reasons.push('Blocks important tasks');
    } else if (overdueTasks.length > 0) {
      reasons.push('Blocks overdue tasks');
    } else {
      reasons.push(`Blocks ${blockedTasks.length} task${blockedTasks.length === 1 ? '' : 's'}`);
    }
  }
  
  // Only mention impact/urgency if user has actually set them (> 0)
  if (task.impact !== undefined && task.impact > 0) {
    if (impact >= 8) {
      reasons.push('High impact');
    } else if (impact >= 5) {
      reasons.push('Medium impact');
    }
  }
  
  if (task.urgency !== undefined && task.urgency > 0) {
    if (urgency >= 8) {
      reasons.push('High urgency');
    } else if (urgency >= 5) {
      reasons.push('Medium urgency');
    }
  }
  
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      reasons.push('Overdue');
    } else if (diffDays === 0) {
      reasons.push('Due today');
    } else if (diffDays === 1) {
      reasons.push('Due tomorrow');
    } else if (diffDays <= 3) {
      reasons.push('Due soon');
    }
  }
  
  if (reasons.length === 0) {
    return 'Recently created';
  }
  
  return reasons.join(', ');
} 