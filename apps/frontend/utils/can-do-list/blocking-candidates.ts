/**
 * Which tasks can be chosen as the blocking task of another task ("blocked by"), and in which order
 * to show them. Shared by the edit-task dialog and the #block hashtag of the add-task field.
 */

import { CanDoItemDecrypted, ProjectDecrypted } from '../api/types';

export type BlockingTaskLike = Pick<CanDoItemDecrypted, 'id' | 'content'> &
  Partial<Pick<CanDoItemDecrypted, 'completed' | 'project_id' | 'blocked_by' | 'parent_task_id' | 'due_date'>>;

export type BlockingProjectLike = Pick<ProjectDecrypted, 'id' | 'name'> &
  Partial<Pick<ProjectDecrypted, 'color' | 'parent_id'>>;

export interface BlockingCandidate<T extends BlockingTaskLike = BlockingTaskLike> {
  task: T;
  /** Project of the task including its parents, e.g. "Work / Reports"; undefined for inbox tasks */
  projectPath?: string;
  projectColor?: string;
  /** Title of the parent task if the task is a subtask */
  parentTitle?: string;
  /** The task lives in the preferred project (normally the project of the task being edited) */
  isSameProject: boolean;
}

export interface BlockingCandidateOptions<T extends BlockingTaskLike> {
  tasks: T[];
  projects?: BlockingProjectLike[];
  /** The task that is being blocked; it and the tasks it would create a cycle with are left out */
  currentTaskId?: string;
  /** Tasks of this project are listed first */
  preferredProjectId?: string;
  /** Search text; every word has to match the task title, its project or its parent task */
  query?: string;
  limit?: number;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Whether blocking `taskId` by `candidateId` would create a cycle, i.e. the candidate is (directly or
 * through other tasks) already blocked by the task.
 */
export function wouldCreateBlockingCycle(
  taskId: string,
  candidateId: string,
  tasks: Pick<BlockingTaskLike, 'id' | 'blocked_by'>[],
): boolean {
  const blockedByOf = new Map(tasks.map(task => [task.id, task.blocked_by]));
  const visited = new Set<string>();
  let current: string | undefined = candidateId;

  while (current && !visited.has(current)) {
    if (current === taskId) return true;
    visited.add(current);
    current = blockedByOf.get(current);
  }
  return false;
}

function getProjectPath(
  projectId: string | undefined,
  projectsById: Map<string, BlockingProjectLike>,
): { path?: string; color?: string } {
  if (!projectId) return {};
  const project = projectsById.get(projectId);
  if (!project) return {};

  const names: string[] = [];
  const seen = new Set<string>();
  let current: BlockingProjectLike | undefined = project;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parent_id ? projectsById.get(current.parent_id) : undefined;
  }
  return { path: names.join(' / '), color: project.color };
}

/** How well the search words match: higher is better, null if a word does not match at all. */
function getMatchScore(words: string[], title: string, context: string): number | null {
  let score = 0;
  for (const word of words) {
    if (title.startsWith(word)) score += 3;
    else if (title.includes(` ${word}`)) score += 2;
    else if (title.includes(word)) score += 1;
    else if (context.includes(word)) score += 0;
    else return null;
  }
  return score;
}

/**
 * The tasks that can be chosen as blocker, best first: by match quality of the search text, then tasks of
 * the preferred project, then alphabetically (without a search text: preferred project first). Completed tasks, the task itself and tasks that would
 * form a blocking cycle are not offered.
 */
export function getBlockingCandidates<T extends BlockingTaskLike>(
  options: BlockingCandidateOptions<T>,
): BlockingCandidate<T>[] {
  const { tasks, projects = [], currentTaskId, preferredProjectId, query, limit } = options;
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const tasksById = new Map(tasks.map(task => [task.id, task]));
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  const scored: { candidate: BlockingCandidate<T>; score: number }[] = [];

  for (const task of tasks) {
    if (task.completed || task.id === currentTaskId) continue;
    if (currentTaskId && wouldCreateBlockingCycle(currentTaskId, task.id, tasks)) continue;

    const { path, color } = getProjectPath(task.project_id, projectsById);
    const parentTitle = task.parent_task_id ? tasksById.get(task.parent_task_id)?.content : undefined;

    const title = task.content.toLowerCase();
    const context = `${path ?? ''} ${parentTitle ?? ''}`.toLowerCase();
    const score = words.length > 0 ? getMatchScore(words, title, context) : 0;
    if (score === null) continue;

    scored.push({
      score,
      candidate: {
        task,
        projectPath: path,
        projectColor: color,
        parentTitle,
        isSameProject: Boolean(preferredProjectId) && task.project_id === preferredProjectId,
      },
    });
  }

  scored.sort((left, right) => {
    // While searching, the better match wins; the preferred project only decides between equal matches
    if (left.score !== right.score) return right.score - left.score;
    if (left.candidate.isSameProject !== right.candidate.isSameProject) {
      return left.candidate.isSameProject ? -1 : 1;
    }
    return collator.compare(left.candidate.task.content, right.candidate.task.content);
  });

  const candidates = scored.map(entry => entry.candidate);
  return limit === undefined ? candidates : candidates.slice(0, limit);
}
