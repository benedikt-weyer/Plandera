'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Locale } from 'date-fns';
import { Language, TranslationParams } from '@/utils/i18n/types';
import { t as translate, setLanguage, getLanguage, initI18n, getLanguageName, getAvailableLanguages } from '@/utils/i18n/i18n';
import { getDateLocale } from '@/utils/i18n/date-locale';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: TranslationParams) => string;
  availableLanguages: Language[];
  getLanguageName: (lang: Language) => string;
  isLoading: boolean;
  dateLocale: Locale;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Initialize i18n system
  useEffect(() => {
    const init = async () => {
      try {
        // Priority: localStorage > browser language > default 'en'
        const savedLanguage = localStorage.getItem('language') as Language | null;
        const browserLanguage = navigator.language.split('-')[0] as Language;
        const availableLanguages = getAvailableLanguages();
        
        const initialLanguage = 
          savedLanguage && availableLanguages.includes(savedLanguage)
            ? savedLanguage
            : availableLanguages.includes(browserLanguage)
            ? browserLanguage
            : 'en';

        await initI18n(initialLanguage);
        setLanguageState(initialLanguage);
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        setLanguageState('en');
        setInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = useCallback((key: string, params?: TranslationParams) => {
    if (!initialized) {
      return key; // Return key if not initialized yet
    }
    return translate(key, params);
  }, [initialized]);

  const dateLocale = getDateLocale(language);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        t,
        availableLanguages: getAvailableLanguages(),
        getLanguageName,
        isLoading,
        dateLocale,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Hook for translations only (more convenient)
export function useTranslation() {
  const { t } = useLanguage();
  return { t };
}

// Hook for date locale
export function useDateLocale() {
  const { dateLocale } = useLanguage();
  return dateLocale;
}

