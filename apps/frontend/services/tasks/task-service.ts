'use client';

import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { CanDoItemDecrypted, CreateCanDoItemDecryptedRequest, UpdateCanDoItemDecryptedRequest } from '@/utils/api/types';

/**
 * Task Service - handles all task-related operations using the decrypted backend
 */
export class TaskService {
  constructor(private backend: DecryptedBackendInterface) {}

  /**
   * Get all tasks for the current user
   */
  async getTasks(): Promise<CanDoItemDecrypted[]> {
    try {
      const { data: tasks } = await this.backend.canDoList.getAll();
      return tasks;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      throw new Error('Failed to load tasks');
    }
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(id: string): Promise<CanDoItemDecrypted> {
    try {
      const { data: task } = await this.backend.canDoList.getById(id);
      if (!task) {
        throw new Error('Task not found');
      }
      return task;
    } catch (error) {
      console.error(`Failed to fetch task ${id}:`, error);
      throw new Error('Failed to load task');
    }
  }

  /**
   * Get tasks filtered by project
   */
  async getTasksByProject(projectId: string | null): Promise<CanDoItemDecrypted[]> {
    try {
      const tasks = await this.getTasks();
      return tasks.filter(task => task.project_id === projectId);
    } catch (error) {
      console.error('Failed to fetch tasks by project:', error);
      throw new Error('Failed to load project tasks');
    }
  }

  /**
   * Create a new task
   */
  async createTask(taskData: CreateCanDoItemDecryptedRequest): Promise<CanDoItemDecrypted> {
    try {
      // Convert empty strings to undefined for UUID fields
      const cleanedTaskData = {
        ...taskData,
        project_id: taskData.project_id || undefined,
        blocked_by: taskData.blocked_by || undefined,
        parent_task_id: taskData.parent_task_id || undefined,
      };
      
      const { data: task } = await this.backend.canDoList.create(cleanedTaskData);
      if (!task) {
        throw new Error('Failed to create task - no data returned');
      }
      return task;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(updateData: UpdateCanDoItemDecryptedRequest): Promise<CanDoItemDecrypted> {
    try {
      // Convert empty strings to undefined for UUID fields
      const cleanedUpdateData = {
        ...updateData,
        project_id: updateData.project_id || undefined,
        blocked_by: updateData.blocked_by || undefined,
        parent_task_id: updateData.parent_task_id || undefined,
      };
      
      const { data: task } = await this.backend.canDoList.update(cleanedUpdateData);
      if (!task) {
        throw new Error('Failed to update task - no data returned');
      }
      return task;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw new Error('Failed to update task');
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    try {
      await this.backend.canDoList.delete(id);
    } catch (error) {
      console.error(`Failed to delete task ${id}:`, error);
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Toggle task completion status
   */
  async toggleTaskComplete(taskId: string, completed: boolean): Promise<CanDoItemDecrypted> {
    try {
      const { data: task } = await this.backend.canDoList.update({
        id: taskId,
        completed: completed,
      });
      if (!task) {
        throw new Error('Failed to toggle task complete - no data returned');
      }
      return task;
    } catch (error) {
      console.error('Failed to toggle task complete:', error);
      throw new Error('Failed to update task status');
    }
  }

  /**
   * Move task to a different project
   */
  async moveTaskToProject(taskId: string, projectId: string | null): Promise<CanDoItemDecrypted> {
    try {
      const { data: task } = await this.backend.canDoList.update({
        id: taskId,
        project_id: projectId || undefined,
      });
      if (!task) {
        throw new Error('Failed to move task - no data returned');
      }
      return task;
    } catch (error) {
      console.error('Failed to move task to project:', error);
      throw new Error('Failed to move task');
    }
  }

  /**
   * Reorder tasks by updating display order
   */
  async reorderTasks(taskUpdates: Array<{ id: string; displayOrder: number }>): Promise<void> {
    try {
      // Update each task's display order
      for (const update of taskUpdates) {
        await this.backend.canDoList.update({
          id: update.id,
          display_order: update.displayOrder,
        });
      }
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      throw new Error('Failed to reorder tasks');
    }
  }

  /**
   * Bulk delete multiple tasks
   */
  async bulkDeleteTasks(taskIds: string[]): Promise<void> {
    try {
      for (const taskId of taskIds) {
        await this.backend.canDoList.delete(taskId);
      }
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
      throw new Error('Failed to delete tasks');
    }
  }

  /**
   * Bulk delete completed tasks, optionally filtered by project
   */
  async bulkDeleteCompletedTasks(projectId?: string): Promise<number> {
    try {
      const tasks = await this.getTasks();
      const completedTasks = tasks.filter(task => {
        const isCompleted = task.completed;
        const matchesProject = projectId ? task.project_id === projectId : true;
        return isCompleted && matchesProject;
      });

      await this.bulkDeleteTasks(completedTasks.map(task => task.id));
      return completedTasks.length;
    } catch (error) {
      console.error('Failed to bulk delete completed tasks:', error);
      throw new Error('Failed to delete completed tasks');
    }
  }

  /**
   * Update task order in bulk
   */
  async bulkUpdateTaskOrder(taskUpdates: { id: string; order: number }[]): Promise<void> {
    try {
      for (const { id, order } of taskUpdates) {
        await this.backend.canDoList.update({
          id,
          display_order: order,
        });
      }
    } catch (error) {
      console.error('Failed to bulk update task order:', error);
      throw new Error('Failed to update task order');
    }
  }

  /**
   * Search tasks by content, description, or tags
   */
  async searchTasks(query: string, tasks?: CanDoItemDecrypted[]): Promise<CanDoItemDecrypted[]> {
    try {
      const allTasks = tasks || await this.getTasks();
      const lowercaseQuery = query.toLowerCase();
      
      return allTasks.filter(task => 
        task.content.toLowerCase().includes(lowercaseQuery) ||
        (task.tags && task.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)))
      );
    } catch (error) {
      console.error('Failed to search tasks:', error);
      throw new Error('Failed to search tasks');
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(projectId?: string): Promise<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    myDay: number;
  }> {
    try {
      const tasks = await this.getTasks();
      const filteredTasks = projectId 
        ? tasks.filter(task => task.project_id === projectId)
        : tasks;

      const now = new Date();
      
      return {
        total: filteredTasks.length,
        completed: filteredTasks.filter(task => task.completed).length,
        active: filteredTasks.filter(task => !task.completed).length,
        overdue: filteredTasks.filter(task => 
          !task.completed && 
          task.due_date && 
          new Date(task.due_date) < now
        ).length,
        myDay: filteredTasks.filter(task => task.my_day).length,
      };
    } catch (error) {
      console.error('Failed to get task stats:', error);
      throw new Error('Failed to load task statistics');
    }
  }

  /**
   * Get tasks due today or overdue
   */
  async getMyDayTasks(): Promise<CanDoItemDecrypted[]> {
    try {
      const tasks = await this.getTasks();
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      return tasks.filter(task => 
        !task.completed && (
          task.my_day ||
          (task.due_date && new Date(task.due_date) <= today)
        )
      );
    } catch (error) {
      console.error('Failed to get My Day tasks:', error);
      throw new Error('Failed to load My Day tasks');
    }
  }

  /**
   * Toggle My Day status for a task
   */
  async toggleMyDay(taskId: string, myDay: boolean): Promise<CanDoItemDecrypted> {
    try {
      const { data: task } = await this.backend.canDoList.update({
        id: taskId,
        my_day: myDay,
      });
      if (!task) {
        throw new Error('Failed to toggle My Day - no data returned');
      }
      return task;
    } catch (error) {
      console.error('Failed to toggle My Day:', error);
      throw new Error('Failed to update My Day status');
    }
  }
}
