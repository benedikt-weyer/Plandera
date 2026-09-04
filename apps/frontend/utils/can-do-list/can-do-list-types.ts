import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';

export interface CanDoList {
  tasks: CanDoItemDecrypted[];
}

// Default project constant
export const DEFAULT_PROJECT_NAME = 'Inbox';
export const DEFAULT_PROJECT_COLOR = '#6b7280'; // gray-500