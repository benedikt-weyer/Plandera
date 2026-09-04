'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface SchedulerNavContextType {
  schedulerNavContent: ReactNode | null;
  schedulerNavActions: ReactNode | null;
  setSchedulerNavContent: (content: ReactNode | null) => void;
  setSchedulerNavActions: (content: ReactNode | null) => void;
}

const SchedulerNavContext = createContext<SchedulerNavContextType | undefined>(undefined);

export function SchedulerNavProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [schedulerNavContent, setSchedulerNavContent] = useState<ReactNode | null>(null);
  const [schedulerNavActions, setSchedulerNavActions] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({
      schedulerNavContent,
      schedulerNavActions,
      setSchedulerNavContent,
      setSchedulerNavActions,
    }),
    [schedulerNavActions, schedulerNavContent],
  );

  return (
    <SchedulerNavContext.Provider value={value}>
      {children}
    </SchedulerNavContext.Provider>
  );
}

export function useSchedulerNav() {
  const context = useContext(SchedulerNavContext);
  if (context === undefined) {
    throw new Error('useSchedulerNav must be used within a SchedulerNavProvider');
  }
  return context;
}

