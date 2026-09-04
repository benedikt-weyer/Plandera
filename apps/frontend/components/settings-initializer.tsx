'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import '@/utils/api/init';

export function SettingsInitializer({ children }: { children: React.ReactNode }) {
  const loadSettings = useSettingsStore(state => state.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return <>{children}</>;
}
