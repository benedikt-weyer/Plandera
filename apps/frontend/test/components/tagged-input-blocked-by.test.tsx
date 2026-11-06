import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaggedInput, Tag } from '@/components/ui/tagged-input';
import { extractTaskDataFromTags } from '@/utils/can-do-list/hashtag-utils';

const tasks = [
  { id: 't1', content: 'Write report', completed: false, project_id: 'p1' },
  { id: 't2', content: 'Review report draft', completed: false },
  { id: 't3', content: 'Book flights', completed: false },
  { id: 't4', content: 'Old report', completed: true },
];
const projects = [{ id: 'p1', name: 'Work' }];

function Harness({ onTags }: { onTags?: (tags: Tag[]) => void }) {
  const [value, setValue] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  return (
    <div>
      <TaggedInput
        value={value}
        onChange={setValue}
        tags={tags}
        onTagsChange={(next) => {
          setTags(next);
          onTags?.(next);
        }}
        tasks={tasks}
        projects={projects}
        placeholder="Add task"
      />
      <output data-testid="value">{value}</output>
    </div>
  );
}

describe('TaggedInput #block (blocked by a task)', () => {
  it('offers all open tasks after #block, but not completed ones', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText('Add task'), '#block');

    expect(await screen.findByText('#block Write report')).toBeInTheDocument();
    expect(screen.getByText('#block Review report draft')).toBeInTheDocument();
    expect(screen.getByText('#block Book flights')).toBeInTheDocument();
    expect(screen.queryByText('#block Old report')).not.toBeInTheDocument();
    // the task's project is shown as extra information
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('filters the tasks by the text typed right after the hashtag', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText('Add task'), '#blockreport');

    expect(await screen.findByText('#block Write report')).toBeInTheDocument();
    expect(screen.getByText('#block Review report draft')).toBeInTheDocument();
    expect(screen.queryByText('#block Book flights')).not.toBeInTheDocument();
  });

  it('also accepts #blocked and #blockedby as the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Add task');

    await user.type(input, '#blockedflights');
    expect(await screen.findByText('#block Book flights')).toBeInTheDocument();
    expect(screen.queryByText('#block Write report')).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '#blockedbyflights');
    expect(await screen.findByText('#block Book flights')).toBeInTheDocument();
  });

  it('shows nothing when no open task matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText('Add task'), '#blockzzz');

    await waitFor(() => expect(screen.queryByText(/^#block /)).not.toBeInTheDocument());
  });

  it('creates a blocked-by tag from the chosen task and removes the hashtag from the text', async () => {
    const user = userEvent.setup();
    const onTags = jest.fn();
    render(<Harness onTags={onTags} />);

    await user.type(screen.getByPlaceholderText('Add task'), 'Send it #blockwrite');
    await user.click(await screen.findByText('#block Write report'));

    const tags: Tag[] = onTags.mock.calls.at(-1)![0];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({
      type: 'blocked-by',
      blockedByTaskId: 't1',
      blockedByTaskTitle: 'Write report',
    });
    expect(screen.getByTestId('value')).toHaveTextContent('Send it');
    expect(screen.getByTestId('value').textContent).not.toContain('#block');
    expect(screen.getByText('Blocked by: Write report')).toBeInTheDocument();
  });

  it('a task can only be blocked by one task: a new choice replaces the previous tag', async () => {
    const user = userEvent.setup();
    const onTags = jest.fn();
    render(<Harness onTags={onTags} />);
    const input = screen.getByPlaceholderText('Add task');

    await user.type(input, '#blockwrite');
    await user.click(await screen.findByText('#block Write report'));
    await user.type(input, '#blockflights');
    await user.click(await screen.findByText('#block Book flights'));

    const tags: Tag[] = onTags.mock.calls.at(-1)![0];
    expect(tags.map((t) => t.blockedByTaskId)).toEqual(['t3']);
    expect(screen.queryByText('Blocked by: Write report')).not.toBeInTheDocument();
    expect(screen.getByText('Blocked by: Book flights')).toBeInTheDocument();
  });

  it('can remove the blocked-by tag again', async () => {
    const user = userEvent.setup();
    const onTags = jest.fn();
    render(<Harness onTags={onTags} />);

    await user.type(screen.getByPlaceholderText('Add task'), '#blockflights');
    await user.click(await screen.findByText('#block Book flights'));
    await user.click(screen.getByRole('button'));

    expect(onTags.mock.calls.at(-1)![0]).toEqual([]);
  });
});

describe('extractTaskDataFromTags with a blocked-by tag', () => {
  it('returns the id of the blocking task and keeps the content', () => {
    const tags: Tag[] = [
      { id: '1', text: '#block Write report', type: 'blocked-by', blockedByTaskId: 't1', blockedByTaskTitle: 'Write report' },
      { id: '2', text: '#d15m', type: 'duration', duration: 15 },
    ];

    expect(extractTaskDataFromTags('Send it', tags)).toMatchObject({
      content: 'Send it',
      blockedBy: 't1',
      duration: 15,
    });
  });

  it('has no blocker without such a tag', () => {
    expect(extractTaskDataFromTags('Send it', []).blockedBy).toBeUndefined();
  });
});
