import { create } from 'zustand';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { UserSettingsDecrypted } from '@/utils/api/types';
import type { Language } from '@/utils/i18n/types';

interface SettingsState {
  settings: UserSettingsDecrypted;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettingsDecrypted>) => Promise<void>;
  syncLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    taskClickBehavior: 'edit',
    weekStartsOn: 1,
    language: 'en',
  },
  loading: true,
  error: null,

  loadSettings: async () => {
    try {
      set({ loading: true });
      
      const backend = getDecryptedBackend();
      const response = await backend.userSettings.get();
      
      if (response.error) {
        set({ error: response.error, loading: false });
      } else if (response.data) {
        set({ settings: response.data, error: null, loading: false });
        
        // Sync language to localStorage for LanguageContext to pick up on next load
        if (response.data.language) {
          localStorage.setItem('language', response.data.language);
        }
      }
    } catch (err) {
      // If user is not authenticated, just use default settings
      console.warn('Failed to load user settings (user may not be logged in):', err);
      set({ error: null, loading: false });
    }
  },

  updateSettings: async (newSettings: Partial<UserSettingsDecrypted>) => {
    try {
      const currentSettings = get().settings;
      const backend = getDecryptedBackend();
      const updatedSettings = { ...currentSettings, ...newSettings };
      const response = await backend.userSettings.update(updatedSettings);
      
      if (response.error) {
        set({ error: response.error });
        throw new Error(response.error);
      } else if (response.data) {
        set({ settings: response.data, error: null });
      }
    } catch (err) {
      console.error('Failed to update user settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      set({ error: errorMessage });
      throw err;
    }
  },

  syncLanguage: (language: Language) => {
    set(state => ({
      settings: { ...state.settings, language }
    }));
  },
}));

// Convenience hooks for specific settings
export const useWeekStartDay = (): 0 | 1 => {
  return useSettingsStore(state => state.settings.weekStartsOn ?? 1);
};

export const useTaskClickBehavior = () => {
  return useSettingsStore(state => state.settings.taskClickBehavior ?? 'edit');
};

export const useSettingsLanguage = () => {
  return useSettingsStore(state => state.settings.language ?? 'en');
};
