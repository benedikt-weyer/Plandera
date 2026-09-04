import { Locale } from 'date-fns';
import { enUS, de, es } from 'date-fns/locale';
import type { Language } from './types';

/**
 * Get the date-fns locale object for the given language
 */
export function getDateLocale(language: Language): Locale {
  switch (language) {
    case 'de':
      return de;
    case 'es':
      return es;
    case 'en':
    default:
      return enUS;
  }
}

