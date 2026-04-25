'use client';

import { CanDoItemDecrypted, ProjectDecrypted, CreateCanDoItemDecryptedRequest, UpdateCanDoItemDecryptedRequest, CreateProjectDecryptedRequest, UpdateProjectDecryptedRequest } from '@/utils/api/types';
import { TaskService } from '@/services/tasks/task-service';
import { ProjectService } from '@/services/projects/project-service';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';

/**
 * Can Do List Page Service - combines task and project services
 * to provide higher-level operations specific to the can-do list page
 */
export class CanDoListPageService {
  public taskService: TaskService;
  public projectService: ProjectService;

  constructor(backend: DecryptedBackendInterface) {
    this.taskService = new TaskService(backend);
    this.projectService = new ProjectService(backend);
  }

  /**
   * Load all tasks and projects together
   */
  async loadCanDoListData(): Promise<{ tasks: CanDoItemDecrypted[]; projects: ProjectDecrypted[] }> {
    try {
      // Load both tasks and projects in parallel
      const [tasks, projects] = await Promise.all([
        this.taskService.getTasks(),
        this.projectService.getProjects()
      ]);
      
      return { tasks, projects };
    } catch (error) {
      console.error('Failed to load can-do list data:', error);
      throw new Error('Failed to load can-do list data');
    }
  }

  /**
   * Create a new task with smart project assignment
   */
  async createTask(
    content: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string
  ): Promise<{ task: CanDoItemDecrypted; shouldRefreshProjects: boolean }> {
    try {
      // Use the provided projectId as-is
      // If projectId is undefined/null, the task will be created in the inbox (without a project)
      // Only create a default project if explicitly needed by other parts of the system
      let finalProjectId = projectId;
      let shouldRefreshProjects = false;

      const taskData: CreateCanDoItemDecryptedRequest = {
        content,
        completed: false,
        due_date: dueDate ? dueDate.toISOString() : undefined,
        impact,
        urgency,
        duration_minutes: duration,
        blocked_by: blockedBy,
        my_day: myDay || false,
        project_id: finalProjectId,
        parent_task_id: parentTaskId,
        display_order: 0, // Will be set by backend
      };

      const task = await this.taskService.createTask(taskData);
      
      return { task, shouldRefreshProjects };
    } catch (error) {
      console.error('Failed to create task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Update a task with validation
   */
  async updateTask(
    id: string,
    content?: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean,
    parentTaskId?: string
  ): Promise<CanDoItemDecrypted> {
    try {
      const updateData: UpdateCanDoItemDecryptedRequest = {
        id,
        ...(content !== undefined && { content }),
        ...(duration !== undefined && { duration_minutes: duration }),
        ...(projectId !== undefined && { project_id: projectId }),
        ...(impact !== undefined && { impact }),
        ...(urgency !== undefined && { urgency }),
        ...(dueDate !== undefined && { due_date: dueDate ? dueDate.toISOString() : undefined }),
        ...(blockedBy !== undefined && { blocked_by: blockedBy }),
        ...(myDay !== undefined && { my_day: myDay }),
        ...(parentTaskId !== undefined && { parent_task_id: parentTaskId }),
      };

      return await this.taskService.updateTask(updateData);
    } catch (error) {
      console.error(`Failed to update task ${id}:`, error);
      throw new Error('Failed to update task');
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.taskService.deleteTask(taskId);
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Toggle task completion with smart reordering
   */
  async toggleTaskComplete(taskId: string, completed: boolean): Promise<CanDoItemDecrypted> {
    try {
      return await this.taskService.toggleTaskComplete(taskId, completed);
    } catch (error) {
      console.error(`Failed to toggle task complete ${taskId}:`, error);
      throw new Error('Failed to update task status');
    }
  }

  /**
   * Move task to a different project
   */
  async moveTaskToProject(taskId: string, projectId: string | null): Promise<CanDoItemDecrypted> {
    try {
      return await this.taskService.moveTaskToProject(taskId, projectId);
    } catch (error) {
      console.error(`Failed to move task ${taskId} to project ${projectId}:`, error);
      throw new Error('Failed to move task');
    }
  }

  /**
   * Reorder tasks within a project or globally
   */
  async reorderTasks(sourceIndex: number, destinationIndex: number, projectId?: string): Promise<boolean> {
    try {
      // Get current tasks for the project or all tasks
      const allTasks = await this.taskService.getTasks();
      const tasks = projectId 
        ? allTasks.filter(task => task.project_id === projectId && !task.completed)
        : allTasks.filter(task => !task.completed);

      if (sourceIndex < 0 || sourceIndex >= tasks.length || 
          destinationIndex < 0 || destinationIndex >= tasks.length) {
        return false;
      }

      // Create new order
      const reorderedTasks = [...tasks];
      const [movedTask] = reorderedTasks.splice(sourceIndex, 1);
      reorderedTasks.splice(destinationIndex, 0, movedTask);

      // Update display orders
      const taskUpdates = reorderedTasks.map((task, index) => ({
        id: task.id,
        displayOrder: index
      }));

      await this.taskService.reorderTasks(taskUpdates);
      return true;
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      throw new Error('Failed to reorder tasks');
    }
  }

  /**
   * Bulk delete completed tasks with optional project filter
   */
  async bulkDeleteCompletedTasks(projectId?: string): Promise<number> {
    try {
      return await this.taskService.bulkDeleteCompletedTasks(projectId);
    } catch (error) {
      console.error('Failed to bulk delete completed tasks:', error);
      throw new Error('Failed to delete completed tasks');
    }
  }

  /**
   * Toggle My Day status for a task
   */
  async toggleMyDay(taskId: string, myDay: boolean): Promise<CanDoItemDecrypted> {
    try {
      return await this.taskService.toggleMyDay(taskId, myDay);
    } catch (error) {
      console.error(`Failed to toggle My Day for task ${taskId}:`, error);
      throw new Error('Failed to update My Day status');
    }
  }

  /**
   * Create a new project
   */
  async createProject(name: string, description?: string, color?: string, parentId?: string): Promise<{ project: ProjectDecrypted; shouldRefreshTasks: boolean }> {
    try {
      const projectData: CreateProjectDecryptedRequest = {
        name,
        description,
        color: color || '#3b82f6',
        parent_id: parentId,
        order: 0, // Will be set by backend
      };

      const project = await this.projectService.createProject(projectData);
      
      return { project, shouldRefreshTasks: false };
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project');
    }
  }

  /**
   * Update a project
   */
  async updateProject(id: string, updateData: Partial<UpdateProjectDecryptedRequest>): Promise<ProjectDecrypted> {
    try {
      return await this.projectService.updateProject(id, updateData);
    } catch (error) {
      console.error(`Failed to update project ${id}:`, error);
      throw new Error('Failed to update project');
    }
  }

  /**
   * Delete a project and handle its tasks
   */
  async deleteProjectWithTasks(projectId: string): Promise<void> {
    try {
      // Get all projects and tasks
      const [allProjects, allTasks] = await Promise.all([
        this.projectService.getProjects(),
        this.taskService.getTasks()
      ]);
      
      const projectToDelete = allProjects.find(proj => proj.id === projectId);
      
      if (!projectToDelete) {
        throw new Error('Project not found');
      }

      // Delete all tasks assigned directly to this project before deleting it.
      const tasksInProject = allTasks.filter(task => task.project_id === projectId);
      for (const task of tasksInProject) {
        await this.taskService.deleteTask(task.id);
      }
      
      // Handle child projects
      await this.projectService.deleteProjectWithChildren(projectId, true);
    } catch (error) {
      console.error(`Failed to delete project with tasks ${projectId}:`, error);
      throw new Error('Failed to delete project and its tasks');
    }
  }

  /**
   * Reorder projects
   */
  async reorderProjects(projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<void> {
    try {
      await this.projectService.reorderProjects(projectUpdates);
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      throw new Error('Failed to reorder projects');
    }
  }

  /**
   * Toggle project collapse state
   */
  async toggleProjectCollapse(projectId: string, isCollapsed: boolean): Promise<ProjectDecrypted> {
    try {
      return await this.projectService.toggleProjectCollapse(projectId, isCollapsed);
    } catch (error) {
      console.error(`Failed to toggle project collapse ${projectId}:`, error);
      throw new Error('Failed to update project state');
    }
  }

  /**
   * Get tasks filtered by various criteria
   */
  async getFilteredTasks(filter: {
    projectId?: string | null;
    completed?: boolean;
    myDay?: boolean;
    overdue?: boolean;
    search?: string;
  }): Promise<CanDoItemDecrypted[]> {
    try {
      let tasks = await this.taskService.getTasks();
      
      // Apply filters
      if (filter.projectId !== undefined) {
        tasks = tasks.filter(task => task.project_id === filter.projectId);
      }
      
      if (filter.completed !== undefined) {
        tasks = tasks.filter(task => task.completed === filter.completed);
      }
      
      if (filter.myDay) {
        tasks = tasks.filter(task => task.my_day);
      }
      
      if (filter.overdue) {
        const now = new Date();
        tasks = tasks.filter(task => 
          !task.completed && 
          task.due_date && 
          new Date(task.due_date) < now
        );
      }
      
      if (filter.search) {
        tasks = await this.taskService.searchTasks(filter.search, tasks);
      }
      
      return tasks;
    } catch (error) {
      console.error('Failed to get filtered tasks:', error);
      throw new Error('Failed to load filtered tasks');
    }
  }

  /**
   * Get My Day tasks
   */
  async getMyDayTasks(): Promise<CanDoItemDecrypted[]> {
    try {
      return await this.taskService.getMyDayTasks();
    } catch (error) {
      console.error('Failed to get My Day tasks:', error);
      throw new Error('Failed to load My Day tasks');
    }
  }

  /**
   * Get recommended tasks (high priority, due soon, etc.)
   */
  async getRecommendedTasks(): Promise<CanDoItemDecrypted[]> {
    try {
      const tasks = await this.taskService.getTasks();
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Filter for high-priority or due-soon tasks
      return tasks.filter(task => 
        !task.completed && (
          (task.impact && task.impact >= 4) ||
          (task.urgency && task.urgency >= 4) ||
          (task.due_date && new Date(task.due_date) <= tomorrow) ||
          task.my_day
        )
      ).sort((a, b) => {
        // Sort by priority and due date
        const aPriority = (a.impact || 0) + (a.urgency || 0);
        const bPriority = (b.impact || 0) + (b.urgency || 0);
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        
        return 0;
      });
    } catch (error) {
      console.error('Failed to get recommended tasks:', error);
      throw new Error('Failed to load recommended tasks');
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    tasks: {
      total: number;
      completed: number;
      active: number;
      overdue: number;
      myDay: number;
    };
    projects: {
      totalProjects: number;
      rootProjects: number;
      defaultProjectId?: string;
    };
  }> {
    try {
      const [taskStats, projectStats] = await Promise.all([
        this.taskService.getTaskStats(),
        this.projectService.getProjectStats()
      ]);
      
      return {
        tasks: taskStats,
        projects: projectStats
      };
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      throw new Error('Failed to load dashboard statistics');
    }
  }

  /**
   * Search across tasks and projects
   */
  async searchAll(query: string): Promise<{
    tasks: CanDoItemDecrypted[];
    projects: ProjectDecrypted[];
  }> {
    try {
      const [tasks, projects] = await Promise.all([
        this.taskService.searchTasks(query),
        this.projectService.searchProjects(query)
      ]);
      
      return { tasks, projects };
    } catch (error) {
      console.error('Failed to search:', error);
      throw new Error('Failed to search');
    }
  }

  /**
   * Validate can-do list operation
   */
  async validateOperation(operation: 'deleteProject' | 'moveTask', params: {
    projectId?: string;
    taskId?: string;
    targetProjectId?: string;
  }): Promise<{ 
    isValid: boolean; 
    message?: string; 
    taskCount?: number;
    childProjects?: ProjectDecrypted[];
  }> {
    try {
      if (operation === 'deleteProject' && params.projectId) {
        const [validation, tasks] = await Promise.all([
          this.projectService.validateProjectOperation('delete', params.projectId),
          this.taskService.getTasksByProject(params.projectId)
        ]);
        
        return {
          ...validation,
          taskCount: tasks.length
        };
      }
      
      return { isValid: true };
    } catch (error) {
      console.error('Failed to validate operation:', error);
      return { isValid: false, message: 'Failed to validate operation' };
    }
  }

}
