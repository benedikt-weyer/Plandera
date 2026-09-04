import { ProjectDecrypted } from '@/utils/api/types';

/**
 * Utility functions for working with hierarchical projects
 */

export interface ProjectNode extends ProjectDecrypted {
  children: ProjectNode[];
  level: number;
}

/**
 * Build a hierarchical tree structure from flat project list
 */
export function buildProjectTree(projects: ProjectDecrypted[]): ProjectNode[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const projectMap = new Map<string, ProjectNode>();
  const rootProjects: ProjectNode[] = [];

  // First pass: create all project nodes
  projects.forEach(project => {
    projectMap.set(project.id, {
      ...project,
      children: [],
      level: 0
    });
  });

  // Second pass: build the tree structure
  projects.forEach(project => {
    const projectNode = projectMap.get(project.id)!;
    
    if (project.parent_id) {
      const parent = projectMap.get(project.parent_id);
      if (parent) {
        projectNode.level = parent.level + 1;
        parent.children.push(projectNode);
      } else {
        // Parent not found, treat as root
        rootProjects.push(projectNode);
      }
    } else {
      // Root project
      rootProjects.push(projectNode);
    }
  });

  // Sort children recursively by order
  const sortProjects = (nodes: ProjectNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(node => sortProjects(node.children));
  };

  sortProjects(rootProjects);
  return rootProjects;
}

/**
 * Flatten a project tree back to a list with level information
 */
export function flattenProjectTree(tree: ProjectNode[]): ProjectNode[] {
  const result: ProjectNode[] = [];
  
  const flatten = (nodes: ProjectNode[]) => {
    nodes.forEach(node => {
      result.push(node);
      flatten(node.children);
    });
  };
  
  flatten(tree);
  return result;
}

/**
 * Get all parent projects for a given project
 */
export function getProjectPath(projectId: string, projects: ProjectDecrypted[]): ProjectDecrypted[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const projectMap = new Map<string, ProjectDecrypted>();
  projects.forEach(p => projectMap.set(p.id, p));
  
  const path: ProjectDecrypted[] = [];
  let currentProject = projectMap.get(projectId);
  
  while (currentProject) {
    path.unshift(currentProject);
    currentProject = currentProject.parent_id ? projectMap.get(currentProject.parent_id) : undefined;
  }
  
  return path;
}

/**
 * Get all descendant projects for a given project
 */
export function getProjectDescendants(projectId: string, projects: ProjectDecrypted[]): ProjectDecrypted[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const descendants: ProjectDecrypted[] = [];
  const children = projects.filter(p => p.parent_id === projectId);
  
  children.forEach(child => {
    descendants.push(child);
    descendants.push(...getProjectDescendants(child.id, projects));
  });
  
  return descendants;
}

/**
 * Check if a project can be moved to a new parent (prevents circular references)
 */
export function canMoveProject(projectId: string, newParentId: string | undefined, projects: ProjectDecrypted[]): boolean {
  if (!projects || !Array.isArray(projects)) {
    return true;
  }
  if (!newParentId) return true; // Can always move to root
  if (projectId === newParentId) return false; // Can't be parent of self
  
  // Check if newParentId is a descendant of projectId
  const descendants = getProjectDescendants(projectId, projects);
  return !descendants.some(d => d.id === newParentId);
}

/**
 * Get available parent options for a project (excludes self and descendants)
 * Overloaded to handle both new projects and existing projects
 */
export function getAvailableParents(projects: ProjectDecrypted[]): ProjectDecrypted[];
export function getAvailableParents(projectId: string, projects: ProjectDecrypted[]): ProjectDecrypted[];
export function getAvailableParents(projectIdOrProjects: string | ProjectDecrypted[], projects?: ProjectDecrypted[]): ProjectDecrypted[] {
  // Handle overload: if first param is array, it's for new projects
  if (Array.isArray(projectIdOrProjects)) {
    return projectIdOrProjects || [];
  }
  
  // Handle existing project case
  const projectId = projectIdOrProjects;
  const projectsList = projects || [];
  
  if (!projectsList || !Array.isArray(projectsList)) {
    return [];
  }
  
  const descendants = getProjectDescendants(projectId, projectsList);
  const excludedIds = new Set([projectId, ...descendants.map(d => d.id)]);
  
  return projectsList.filter(p => !excludedIds.has(p.id));
}
