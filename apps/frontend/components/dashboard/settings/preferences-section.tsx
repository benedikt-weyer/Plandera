'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settings-store';
import { useTranslation } from '@/utils/context/LanguageContext';
import { LanguageSelector } from './language-selector';
import { toast } from 'sonner';

export function PreferencesSection() {
  const settings = useSettingsStore(state => state.settings);
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const loading = useSettingsStore(state => state.loading);
  const { t } = useTranslation();

  const handleToggleTaskClickBehavior = async (checked: boolean) => {
    try {
      // checked = true means "edit on click", false means "complete on click"
      await updateSettings({ taskClickBehavior: checked ? 'edit' : 'complete' });
      toast.success(t('settings.settingUpdated'));
    } catch (error) {
      toast.error(t('settings.failedToUpdate'));
      console.error('Failed to update task click behavior:', error);
    }
  };

  const handleToggleWeekStart = async (checked: boolean) => {
    try {
      // checked = true means Monday, false means Sunday
      await updateSettings({ weekStartsOn: checked ? 1 : 0 });
      toast.success(t('settings.weekStartUpdated'));
    } catch (error) {
      toast.error(t('settings.failedToUpdate'));
      console.error('Failed to update week start day:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.preferences')}</CardTitle>
        <CardDescription>{t('settings.preferencesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LanguageSelector />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="task-click-edit">{t('settings.taskClickBehavior')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.taskClickBehaviorDesc')}
            </p>
          </div>
          <Switch
            id="task-click-edit"
            checked={(settings.taskClickBehavior ?? 'edit') === 'edit'}
            onCheckedChange={handleToggleTaskClickBehavior}
            disabled={loading}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="week-start-monday">{t('settings.weekStartsMonday')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.weekStartsMondayDesc')}
            </p>
          </div>
          <Switch
            id="week-start-monday"
            checked={(settings.weekStartsOn ?? 1) === 1}
            onCheckedChange={handleToggleWeekStart}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

