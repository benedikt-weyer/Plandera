import yaml from 'js-yaml';
import type { Language, TranslationObject, Translations, TranslationParams } from './types';

// Cache for loaded translations
let translationsCache: Translations = {};
let currentLanguage: Language = 'en';

// Load all translations at initialization
async function loadTranslations(): Promise<void> {
  if (Object.keys(translationsCache).length > 0) {
    return; // Already loaded
  }

  const languages: Language[] = ['en', 'de', 'es'];
  
  try {
    const loadPromises = languages.map(async (lang) => {
      const response = await fetch(`/locales/${lang}.yaml`);
      if (!response.ok) {
        throw new Error(`Failed to load ${lang} translations`);
      }
      const yamlText = await response.text();
      const translations = yaml.load(yamlText) as TranslationObject;
      return { lang, translations };
    });

    const results = await Promise.all(loadPromises);
    
    results.forEach(({ lang, translations }) => {
      translationsCache[lang] = translations;
    });
  } catch (error) {
    console.error('Failed to load translations:', error);
    // Fallback to English if loading fails
    translationsCache = { en: {} };
  }
}

// Get nested translation value using dot notation
function getNestedValue(obj: TranslationObject, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

// Replace placeholders in translation string
function replacePlaceholders(text: string, params?: TranslationParams): string {
  if (!params) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in params) {
      return String(params[key]);
    }
    return match; // Keep placeholder if no replacement found
  });
}

/**
 * Get translation for a key with optional parameters
 * @param key Translation key in dot notation (e.g., 'common.save')
 * @param params Optional parameters to replace placeholders
 * @returns Translated string
 */
export function t(key: string, params?: TranslationParams): string {
  const translations = translationsCache[currentLanguage] || translationsCache['en'] || {};
  const translation = getNestedValue(translations, key);
  
  if (!translation) {
    // Fallback to English if translation not found
    if (currentLanguage !== 'en') {
      const fallback = getNestedValue(translationsCache['en'] || {}, key);
      if (fallback) {
        return replacePlaceholders(fallback, params);
      }
    }
    
    // Return key if no translation found
    console.warn(`Translation missing for key: ${key} (language: ${currentLanguage})`);
    return key;
  }

  return replacePlaceholders(translation, params);
}

/**
 * Set the current language
 */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

/**
 * Get the current language
 */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Initialize i18n system - must be called before using translations
 */
export async function initI18n(initialLanguage?: Language): Promise<void> {
  await loadTranslations();
  if (initialLanguage) {
    setLanguage(initialLanguage);
  }
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): Language[] {
  return ['en', 'de', 'es'];
}

/**
 * Get language display names
 */
export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
  };
  return names[lang];
}

