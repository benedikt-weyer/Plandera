'use client';

import { useLanguage } from '@/utils/context/LanguageContext';
import { useSettingsStore } from '@/stores/settings-store';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Language } from '@/utils/i18n/types';

export function LanguageSelector() {
  const { language, setLanguage, availableLanguages, getLanguageName, t } = useLanguage();
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const loading = useSettingsStore(state => state.loading);
  const syncLanguage = useSettingsStore(state => state.syncLanguage);

  const handleLanguageChange = async (newLanguage: Language) => {
    try {
      // Update UI language immediately
      setLanguage(newLanguage);
      
      // Sync to UserSettings state (optimistic update)
      syncLanguage(newLanguage);
      
      // Persist to database
      await updateSettings({ language: newLanguage });
      
      toast.success(t('settings.languageUpdated'));
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'));
      console.error('Failed to update language:', error);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="language-select">{t('settings.language')}</Label>
        <p className="text-sm text-muted-foreground">
          {t('settings.languageDesc')}
        </p>
      </div>
      <Select
        value={language}
        onValueChange={handleLanguageChange}
        disabled={loading}
      >
        <SelectTrigger id="language-select" className="w-[180px]">
          <SelectValue placeholder={t('settings.selectLanguage')} />
        </SelectTrigger>
        <SelectContent>
          {availableLanguages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {getLanguageName(lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

