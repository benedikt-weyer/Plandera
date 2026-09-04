/**
 * Shared utility functions for hashtag detection and validation
 */

import { Tag } from '@/components/ui/tagged-input';

/**
 * Check if a word is a valid hashtag that should be converted to a tag
 */
export function isValidHashtag(word: string): boolean {
  const lowercaseWord = word.toLowerCase();
  
  if (!lowercaseWord.startsWith('#')) {
    return false;
  }
  
  return (
    // Duration tags: #d15m, #d1h, #d2h30m, etc.
    /^#d\d+(?:h\d*m?|m|h)$/i.test(lowercaseWord) ||
    // Priority tags: #p5, #i7, #u3, #i7u3
    /^#(?:p\d|i\d(?:u\d)?|u\d)$/i.test(lowercaseWord) ||
    // Due date tags - specific date
    /^#due\d{4}-\d{2}-\d{2}$/i.test(lowercaseWord) ||
    // Due date tags - relative days: #due4d
    /^#due\d+d$/i.test(lowercaseWord) ||
    // Due date tags - named: #duetoday, #duetomorrow, #dueweek
    /^#due(?:today|tomorrow|week)$/i.test(lowercaseWord) ||
    // Due date tags - weekdays: #duemonday, #duenextfriday, etc.
    /^#due(?:next)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(lowercaseWord) ||
    // My day tags: #day
    /^#day$/i.test(lowercaseWord)
  );
}

/**
 * Get the last word before the cursor position
 */
export function getLastWordBeforeCursor(text: string, cursorPosition: number): string {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const words = textBeforeCursor.split(' ');
  return words[words.length - 1];
}

/**
 * Extract task data from tags and content
 * Returns the extracted data and cleaned content
 */
export interface ExtractedTaskData {
  content: string;
  duration?: number;
  projectId?: string;
  impact?: number;
  urgency?: number;
  dueDate?: Date;
  myDay?: boolean;
}

export function extractTaskDataFromTags(content: string, tags: Tag[]): ExtractedTaskData {
  let cleanContent = content.trim();
  const result: ExtractedTaskData = {
    content: cleanContent
  };
  
  // Extract data from tags
  tags.forEach(tag => {
    switch (tag.type) {
      case 'project':
        result.projectId = tag.projectId;
        break;
      case 'my-day':
        result.myDay = tag.myDay || false;
        break;
      case 'duration':
        result.duration = tag.duration;
        break;
      case 'priority':
        result.impact = tag.impact;
        result.urgency = tag.urgency;
        break;
      case 'due-date':
        result.dueDate = tag.dueDate;
        break;
      case 'custom':
        // Custom tags get added back to content
        cleanContent += ` ${tag.text}`;
        break;
    }
  });
  
  // Also parse #day from content if not already set by tags
  if (!result.myDay && /#day/i.test(cleanContent)) {
    result.myDay = true;
    cleanContent = cleanContent.replace(/#day/gi, '').trim();
  }
  
  // Clean up extra spaces
  result.content = cleanContent.replace(/\s+/g, ' ').trim();
  
  return result;
}

