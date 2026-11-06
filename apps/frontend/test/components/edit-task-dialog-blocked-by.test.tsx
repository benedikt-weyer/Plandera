import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/utils/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Opening Radix's Popover takes ~10s per test in jsdom (positioning/focus handling), which has nothing
// to do with the picker content under test, so use a minimal stand-in that just shows its content when open.
jest.mock('@/components/ui/popover', () => {
  const React = require('react');
  const PopoverContext = React.createContext({ open: false, onOpenChange: (_open: boolean) => {} });
  return {
    Popover: ({ open, onOpenChange, children }: any) =>
      React.createElement(PopoverContext.Provider, { value: { open: !!open, onOpenChange } }, children),
    PopoverTrigger: ({ children }: any) => {
      const context = React.useContext(PopoverContext);
      // like Radix, make the trigger a non-submitting button
      return React.cloneElement(children, { type: 'button', onClick: () => context.onOpenChange(!context.open) });
    },
    PopoverContent: ({ children }: any) => {
      const context = React.useContext(PopoverContext);
      return context.open ? React.createElement('div', null, children) : null;
    },
  };
});

// jsdom lacks these, which the Radix/cmdk primitives use
(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();

import EditTaskDialog from '@/components/can-do-list/edit-task-dialog';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';

const base = {
  user_id: 'u',
  display_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  completed: false,
};
const makeTask = (id: string, content: string, extra: Partial<CanDoItemDecrypted> = {}): CanDoItemDecrypted => ({
  ...base,
  id,
  content,
  ...extra,
});
const makeProject = (id: string, name: string, extra: Partial<ProjectDecrypted> = {}): ProjectDecrypted => ({
  id,
  name,
  color: '#3366cc',
  order: 0,
  collapsed: false,
  created_at: '',
  updated_at: '',
  user_id: 'u',
  ...extra,
});

const projects = [makeProject('work', 'Work'), makeProject('reports', 'Reports', { parent_id: 'work' }), makeProject('home', 'Home')];
const current = makeTask('current', 'Send invoice', { project_id: 'work' });
const tasks = [
  current,
  makeTask('a', 'Write report', { project_id: 'reports' }),
  makeTask('b', 'Review draft', { project_id: 'work' }),
  makeTask('c', 'Buy groceries', { project_id: 'home' }),
  makeTask('d', 'Plan taxes'),
  makeTask('done', 'Finished thing', { project_id: 'work', completed: true }),
  makeTask('cyc', 'Depends on invoice', { project_id: 'work', blocked_by: 'current' }),
];

function renderDialog(onSave = jest.fn().mockResolvedValue(undefined)) {
  render(
    <EditTaskDialog task={current} isOpen onClose={jest.fn()} onSave={onSave} projects={projects} tasks={tasks} />,
  );
  return onSave;
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Execution constraints' }));
  // (a combobox has no accessible name from its content, so find the trigger by its text)
  await user.click(screen.getByText('Select a blocking task...').closest('button') as HTMLElement);
}

describe('EditTaskDialog blocked-by picker', () => {
  it('groups tasks of the same project first and shows project paths', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);

    expect(await screen.findByText('Same project')).toBeInTheDocument();
    expect(screen.getByText('Other tasks')).toBeInTheDocument();
    // project hierarchy and inbox are shown under the task titles
    expect(screen.getByText('Work / Reports')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
  });

  it('does not offer the task itself, completed tasks or tasks that would form a cycle', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);

    await screen.findByText('Write report');
    expect(screen.queryByText('Send invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Finished thing')).not.toBeInTheDocument();
    expect(screen.queryByText('Depends on invoice')).not.toBeInTheDocument();
  });

  it('searches by project name too and reports when nothing matches', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openPicker(user);

    const search = await screen.findByPlaceholderText('Search by task or project...');
    await user.type(search, 'home');
    expect(await screen.findByText('Buy groceries')).toBeInTheDocument();
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(await screen.findByText('No open tasks match "zzz".')).toBeInTheDocument();
  });

  it('saves the chosen blocking task', async () => {
    const user = userEvent.setup();
    const onSave = renderDialog();
    await openPicker(user);

    await user.click(await screen.findByText('Buy groceries'));
    // the picker closes and the trigger shows the choice
    await waitFor(() => expect(screen.queryByText('Same project')).not.toBeInTheDocument());
    expect(screen.getByText('Buy groceries').closest('button')).toHaveAttribute('role', 'combobox');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const args = onSave.mock.calls[0];
    expect(args[0]).toBe('current');
    expect(args[7]).toBe('c'); // blockedBy
  });
});
