import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaggedInput, Tag, TaggedInputRef } from '../../components/ui/tagged-input';

describe('TaggedInput', () => {
  const user = userEvent.setup();

  describe('Basic Functionality', () => {
    it('renders input with placeholder', () => {
      render(<TaggedInput placeholder="Enter text here" />);
      expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
    });

    it('handles controlled value changes', async () => {
      const handleChange = jest.fn();
      render(
        <TaggedInput 
          value="" 
          onChange={handleChange} 
          placeholder="Enter text"
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'new content');

      // Check that onChange was called with the final character
      expect(handleChange).toHaveBeenLastCalledWith('t');
      // Check that it was called 11 times (once per character)
      expect(handleChange).toHaveBeenCalledTimes(11);
    });

    it('works with uncontrolled mode', async () => {
      render(<TaggedInput placeholder="Enter text" />);
      
      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'uncontrolled content');

      expect(input).toHaveValue('uncontrolled content');
    });

    it('can be disabled', () => {
      render(<TaggedInput disabled placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeDisabled();
    });
  });

  describe('Duration Tag Parsing', () => {
    it('creates duration tag when space is pressed after #d15m', async () => {
      const handleTagsChange = jest.fn();
      render(
        <TaggedInput 
          placeholder="Enter text"
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task #d15m');
      
      // Trigger space key to create tag
      fireEvent.keyDown(input, { key: ' ' });

      await waitFor(() => {
        expect(handleTagsChange).toHaveBeenCalledWith([
          expect.objectContaining({
            text: '#d15m',
            duration: 15,
            type: 'duration'
          })
        ]);
      });

      // Note: Since we're using external state management via onTagsChange,
      // the tag won't appear in the DOM unless we also pass the tags back
    });

    it('creates duration tag for various formats', async () => {
      const testCases = [
        { input: '#d30', expected: 30 },
        { input: '#d1h', expected: 60 },
        { input: '#d1h30m', expected: 90 },
        { input: '#d1h30', expected: 90 },
        { input: '#d45m', expected: 45 },
      ];

      for (const testCase of testCases) {
        const handleTagsChange = jest.fn();
        const { unmount } = render(
          <TaggedInput 
            placeholder="Enter text"
            onTagsChange={handleTagsChange}
          />
        );

        const input = screen.getByPlaceholderText('Enter text');
        await user.type(input, `Task ${testCase.input}`);
        
        // Trigger space key to create tag
        fireEvent.keyDown(input, { key: ' ' });

        await waitFor(() => {
          expect(handleTagsChange).toHaveBeenCalledWith([
            expect.objectContaining({
              text: testCase.input,
              duration: testCase.expected,
              type: 'duration'
            })
          ]);
        });

        unmount();
      }
    });

    it('ignores invalid duration formats', async () => {
      const handleTagsChange = jest.fn();
      render(
        <TaggedInput 
          placeholder="Enter text"
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task #dinvalid');
      
      // Trigger space key
      fireEvent.keyDown(input, { key: ' ' });

      // Wait a bit to ensure no tag is created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(handleTagsChange).not.toHaveBeenCalled();
    });

    it('overrides existing duration tag with new one', async () => {
      const handleTagsChange = jest.fn();
      const existingTags: Tag[] = [
        { id: '1', text: '#d15m', duration: 15, type: 'duration' }
      ];

      render(
        <TaggedInput 
          placeholder="Enter text"
          tags={existingTags}
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task #d30m ');

      await waitFor(() => {
        expect(handleTagsChange).toHaveBeenCalledWith([
          expect.objectContaining({
            text: '#d30m',
            duration: 30,
            type: 'duration'
          })
        ]);
      });
    });
  });

  describe('Tag Management', () => {
    it('displays existing tags', () => {
      const tags: Tag[] = [
        { id: '1', text: '#d15m', duration: 15, type: 'duration' },
        { id: '2', text: '#custom', type: 'custom' }
      ];

      render(
        <TaggedInput 
          placeholder="Enter text"
          tags={tags}
        />
      );

      expect(screen.getByText('15m')).toBeInTheDocument();
      expect(screen.getByText('#custom')).toBeInTheDocument();
    });

    it('removes tag when X button is clicked', async () => {
      const handleTagsChange = jest.fn();
      const tags: Tag[] = [
        { id: '1', text: '#d15m', duration: 15, type: 'duration' }
      ];

      render(
        <TaggedInput 
          placeholder="Enter text"
          tags={tags}
          onTagsChange={handleTagsChange}
        />
      );

      const removeButton = screen.getByRole('button');
      await user.click(removeButton);

      expect(handleTagsChange).toHaveBeenCalledWith([]);
    });

    it('reserves space for tags even when none exist', () => {
      const { container } = render(<TaggedInput placeholder="Enter text" />);
      const tagsContainer = container.querySelector('.min-h-\\[32px\\]');
      expect(tagsContainer).toBeInTheDocument();
    });

    it('disables tag remove buttons when input is disabled', () => {
      const tags: Tag[] = [
        { id: '1', text: '#d15m', duration: 15, type: 'duration' }
      ];

      render(
        <TaggedInput 
          placeholder="Enter text"
          tags={tags}
          disabled
        />
      );

      const removeButton = screen.getByRole('button');
      expect(removeButton).toBeDisabled();
    });
  });

  describe('Cursor and Focus Management', () => {
    it('maintains focus and cursor position after tag creation', async () => {
      render(<TaggedInput placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Start #d15m end');
      
      // Move cursor to after the tag
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      
      await user.type(input, ' ');

      expect(input).toHaveFocus();
    });
  });

  describe('External onKeyDown Handler', () => {
    it('calls external onKeyDown handler', async () => {
      const handleKeyDown = jest.fn();
      render(
        <TaggedInput 
          placeholder="Enter text"
          onKeyDown={handleKeyDown}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'a');

      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('respects preventDefault from external handler', async () => {
      const handleKeyDown = jest.fn((e) => e.preventDefault());
      const handleTagsChange = jest.fn();
      
      render(
        <TaggedInput 
          placeholder="Enter text"
          onKeyDown={handleKeyDown}
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task #d15m ');

      // Should not create tag if external handler prevents default
      expect(handleTagsChange).not.toHaveBeenCalled();
    });
  });

  describe('Ref Methods', () => {
    it('exposes focus method', () => {
      const ref = React.createRef<TaggedInputRef>();
      render(<TaggedInput ref={ref} placeholder="Enter text" />);

      expect(ref.current?.focus).toBeDefined();
      expect(typeof ref.current?.focus).toBe('function');
    });

    it('exposes getValue and setValue methods', async () => {
      const ref = React.createRef<TaggedInputRef>();
      render(<TaggedInput ref={ref} placeholder="Enter text" />);

      await act(async () => {
        ref.current?.setValue('test value');
      });
      
      await waitFor(() => {
        expect(ref.current?.getValue()).toBe('test value');
      });
    });

    it('exposes tag management methods', async () => {
      const ref = React.createRef<TaggedInputRef>();
      render(<TaggedInput ref={ref} placeholder="Enter text" />);

      const tags: Tag[] = [
        { id: '1', text: '#d15m', duration: 15, type: 'duration' }
      ];

      await act(async () => {
        ref.current?.setTags(tags);
      });
      
      await waitFor(() => {
        expect(ref.current?.getTags()).toEqual(tags);
      });

      await act(async () => {
        ref.current?.clearTags();
      });
      
      await waitFor(() => {
        expect(ref.current?.getTags()).toEqual([]);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty input gracefully', async () => {
      const handleTagsChange = jest.fn();
      render(
        <TaggedInput 
          placeholder="Enter text"
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, ' ');

      expect(handleTagsChange).not.toHaveBeenCalled();
    });

    it('handles multiple spaces', async () => {
      render(<TaggedInput placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task    #d15m');
      
      // Trigger space key to create tag
      fireEvent.keyDown(input, { key: ' ' });

      expect(screen.getByText('15m')).toBeInTheDocument();
    });

    it('handles tag at the beginning of input', async () => {
      const handleTagsChange = jest.fn();
      render(
        <TaggedInput 
          placeholder="Enter text"
          onTagsChange={handleTagsChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, '#d15m');
      
      // Trigger space key to create tag
      fireEvent.keyDown(input, { key: ' ' });

      await waitFor(() => {
        expect(handleTagsChange).toHaveBeenCalledWith([
          expect.objectContaining({
            text: '#d15m',
            duration: 15,
            type: 'duration'
          })
        ]);
      });

      // Note: Since we're using external state management via onTagsChange,
      // the tag won't appear in the DOM unless we also pass the tags back
    });

    it('preserves word before hashtag when no space in between', async () => {
      render(<TaggedInput placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Task#d15m');
      
      // Trigger space key to create tag
      fireEvent.keyDown(input, { key: ' ' });

      // The input should still contain "Task" and the tag should be created
      expect(input).toHaveValue('Task ');
      expect(screen.getByText('15m')).toBeInTheDocument();
    });

    it('handles hashtag in the middle of text', async () => {
      render(<TaggedInput placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      await user.type(input, 'Do task#d30m today');
      
      // Move cursor to after the hashtag
      fireEvent.click(input);
      (input as HTMLInputElement).setSelectionRange(10, 10); // Position after "#d30m"
      
      // Trigger space key to create tag
      fireEvent.keyDown(input, { key: ' ' });

      // The input should preserve "Do task" and " today"
      expect(input).toHaveValue('Do task today');
      expect(screen.getByText('30m')).toBeInTheDocument();
    });
  });
});
