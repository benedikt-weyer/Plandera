// Type definitions for i18n

export type Language = 'en' | 'de' | 'es';

export interface TranslationObject {
  [key: string]: string | TranslationObject;
}

export interface Translations {
  [language: string]: TranslationObject;
}

export type TranslationKey = string;

export interface TranslationParams {
  [key: string]: string | number;
}

