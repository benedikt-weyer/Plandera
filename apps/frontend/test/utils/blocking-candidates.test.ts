import { getBlockingCandidates, wouldCreateBlockingCycle } from '@/utils/can-do-list/blocking-candidates';

const projects = [
  { id: 'work', name: 'Work', color: '#3366cc' },
  { id: 'reports', name: 'Reports', color: '#cc3333', parent_id: 'work' },
  { id: 'home', name: 'Home' },
];

const task = (id: string, content: string, extra: Record<string, unknown> = {}) => ({ id, content, completed: false, ...extra });

const tasks = [
  task('current', 'Send invoice', { project_id: 'work' }),
  task('a', 'Write report', { project_id: 'reports' }),
  task('b', 'Review report draft', { project_id: 'work' }),
  task('c', 'Buy groceries', { project_id: 'home' }),
  task('d', 'Annual taxes'),
  task('done', 'Finished report', { project_id: 'work', completed: true }),
];

const ids = (list: { task: { id: string } }[]) => list.map(candidate => candidate.task.id);

describe('getBlockingCandidates', () => {
  it('leaves out the task itself and completed tasks', () => {
    const result = getBlockingCandidates({ tasks, projects, currentTaskId: 'current' });
    expect(ids(result)).not.toContain('current');
    expect(ids(result)).not.toContain('done');
    expect(ids(result).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves out tasks that would create a blocking cycle', () => {
    const chain = [
      task('current', 'Send invoice'),
      task('x', 'Depends on current', { blocked_by: 'current' }),
      task('y', 'Depends on x', { blocked_by: 'x' }),
      task('z', 'Independent'),
    ];
    const result = getBlockingCandidates({ tasks: chain, currentTaskId: 'current' });
    expect(ids(result)).toEqual(['z']);
  });

  it('lists tasks of the preferred project first, then alphabetically', () => {
    const result = getBlockingCandidates({ tasks, projects, currentTaskId: 'current', preferredProjectId: 'work' });

    // 'b' is the only open task directly in "work"; then Annual taxes, Buy groceries, Write report
    expect(ids(result)).toEqual(['b', 'd', 'c', 'a']);
    expect(result.map(candidate => candidate.isSameProject)).toEqual([true, false, false, false]);
  });

  it('shows the project with its parents and color, and the parent task of subtasks', () => {
    const withSubtask = [...tasks, task('sub', 'Collect receipts', { project_id: 'home', parent_task_id: 'c' })];
    const result = getBlockingCandidates({ tasks: withSubtask, projects, currentTaskId: 'current' });
    const byId = Object.fromEntries(result.map(candidate => [candidate.task.id, candidate]));

    expect(byId.a.projectPath).toBe('Work / Reports');
    expect(byId.a.projectColor).toBe('#cc3333');
    expect(byId.d.projectPath).toBeUndefined(); // inbox task
    expect(byId.sub.parentTitle).toBe('Buy groceries');
  });

  it('finds tasks by their project name as well as by title, with several words', () => {
    // "Write report" does not contain "reports", but it is in the project "Work / Reports"
    expect(ids(getBlockingCandidates({ tasks, projects, currentTaskId: 'current', query: 'reports' }))).toEqual(['a']);
    expect(ids(getBlockingCandidates({ tasks, projects, currentTaskId: 'current', query: 'report draft' }))).toEqual(['b']);
    expect(ids(getBlockingCandidates({ tasks, projects, currentTaskId: 'current', query: 'home groc' }))).toEqual(['c']);
    expect(getBlockingCandidates({ tasks, projects, currentTaskId: 'current', query: 'nothing like this' })).toEqual([]);
  });

  it('ranks title matches above matches that are only in the project', () => {
    const list = [
      task('p', 'Quarterly numbers', { project_id: 'reports' }), // only matches via project "Reports"
      task('q', 'Reports overview'), // title starts with the word
      task('r', 'Annual reports'), // word inside the title
    ];
    const result = getBlockingCandidates({ tasks: list, projects, query: 'reports' });
    expect(ids(result)).toEqual(['q', 'r', 'p']);
  });

  it('keeps better matches first even when another task is in the preferred project', () => {
    const list = [
      task('near', 'Quarterly numbers', { project_id: 'reports' }), // project match only
      task('far', 'Reports overview', { project_id: 'home' }),
    ];
    const result = getBlockingCandidates({ tasks: list, projects, query: 'reports', preferredProjectId: 'reports' });
    expect(ids(result)).toEqual(['far', 'near']);
  });

  it('sorts numbers in titles naturally and ignores case', () => {
    const list = [task('t10', 'Step 10'), task('t2', 'step 2'), task('t1', 'Step 1')];
    expect(ids(getBlockingCandidates({ tasks: list }))).toEqual(['t1', 't2', 't10']);
  });

  it('limits the number of results', () => {
    expect(getBlockingCandidates({ tasks, projects, limit: 2 })).toHaveLength(2);
  });
});

describe('wouldCreateBlockingCycle', () => {
  const list = [
    { id: 'a', blocked_by: undefined },
    { id: 'b', blocked_by: 'a' },
    { id: 'c', blocked_by: 'b' },
  ];

  it('detects direct and indirect cycles', () => {
    expect(wouldCreateBlockingCycle('a', 'b', list)).toBe(true); // b is blocked by a
    expect(wouldCreateBlockingCycle('a', 'c', list)).toBe(true); // c -> b -> a
    expect(wouldCreateBlockingCycle('c', 'a', list)).toBe(false); // a is free; c blocked by a is fine
  });

  it('does not loop forever on already cyclic data', () => {
    const cyclic = [{ id: 'x', blocked_by: 'y' }, { id: 'y', blocked_by: 'x' }];
    expect(wouldCreateBlockingCycle('other', 'x', cyclic)).toBe(false);
  });
});
