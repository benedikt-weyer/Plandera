import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

jest.mock('@/utils/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import AddTaskForm from '@/components/can-do-list/add-task-form';

const tasks = [
  { id: 't1', content: 'Write report', completed: false },
  { id: 't2', content: 'Book flights', completed: false },
];

function Harness({ onSubmit }: { onSubmit: jest.Mock }) {
  const form = useForm<{ content: string }>({ defaultValues: { content: '' } });
  return <AddTaskForm form={form} onSubmit={onSubmit} isLoading={false} tasks={tasks} />;
}

describe('AddTaskForm with #block', () => {
  it('submits the chosen blocking task as blockedBy and the clean title', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox'), 'Send it out #blockwrite');
    await user.click(await screen.findByText('#block Write report'));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ content: 'Send it out', blockedBy: 't1' });
    // the tag is cleared after the task was added
    await waitFor(() => expect(screen.queryByText('Blocked by: Write report')).not.toBeInTheDocument());
  });

  it('submits without a blocker when no #block tag was chosen', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox'), 'Plain task');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].blockedBy).toBeUndefined();
  });
});
