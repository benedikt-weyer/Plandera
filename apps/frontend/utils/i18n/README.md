# Internationalization (i18n) System

This project uses a custom i18n system with YAML-based translations and placeholder support.

## Features

- **Multiple Languages**: Currently supports English (en), German (de), and Spanish (es)
- **YAML Files**: Translations are stored in easy-to-edit YAML files
- **Placeholders**: Support for dynamic values using `{placeholder}` syntax
- **React Context**: Language state managed via React Context
- **Database Persistence**: User's language preference is saved to the database
- **Fallback**: Automatically falls back to English if translation is missing

## File Structure

```
frontend/
├── public/
│   └── locales/
│       ├── en.yaml          # English translations
│       ├── de.yaml          # German translations
│       └── es.yaml          # Spanish translations
├── utils/
│   ├── i18n/
│   │   ├── types.ts         # TypeScript type definitions
│   │   ├── i18n.ts          # Core i18n functions
│   │   └── README.md        # This file
│   └── context/
│       └── LanguageContext.tsx  # React Context for language state
└── components/
    └── dashboard/
        └── settings/
            └── language-selector.tsx  # Language selector component
```

## Usage

### 1. Using translations in components

Import the `useTranslation` hook and call `t()` with the translation key:

```tsx
import { useTranslation } from '@/utils/context/LanguageContext';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.save')}</h1>
      <p>{t('tasks.noTasks')}</p>
    </div>
  );
}
```

### 2. Using translations with placeholders

Pass an object with placeholder values as the second argument:

```tsx
import { useTranslation } from '@/utils/context/LanguageContext';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <p>{t('time.minutes', { count: 5 })}</p>
      {/* Renders: "5 minutes" */}
      
      <p>{t('time.ago', { time: '2 hours' })}</p>
      {/* Renders: "2 hours ago" */}
    </div>
  );
}
```

### 3. Accessing language settings

Use the `useLanguage` hook to access and change the current language:

```tsx
import { useLanguage } from '@/utils/context/LanguageContext';

export function MyComponent() {
  const { language, setLanguage, availableLanguages, getLanguageName } = useLanguage();

  return (
    <div>
      <p>Current language: {getLanguageName(language)}</p>
      <button onClick={() => setLanguage('de')}>
        Switch to German
      </button>
    </div>
  );
}
```

## Adding Translations

### 1. Add to YAML files

Add your translation key to all language files (`public/locales/*.yaml`):

**en.yaml:**
```yaml
mySection:
  myKey: "Hello {name}!"
```

**de.yaml:**
```yaml
mySection:
  myKey: "Hallo {name}!"
```

**es.yaml:**
```yaml
mySection:
  myKey: "¡Hola {name}!"
```

### 2. Use in your component

```tsx
const { t } = useTranslation();
const greeting = t('mySection.myKey', { name: 'World' });
// English: "Hello World!"
// German: "Hallo World!"
// Spanish: "¡Hola World!"
```

## Translation Key Structure

Translation keys use dot notation to access nested values:

```yaml
common:
  save: Save
  cancel: Cancel

tasks:
  addTask: Add a new task...
  noTasks: No tasks yet
```

Access with:
- `t('common.save')` → "Save"
- `t('tasks.addTask')` → "Add a new task..."

## Placeholder Syntax

Placeholders are defined using curly braces: `{placeholderName}`

```yaml
time:
  minutes: "{count} minutes"
  ago: "{time} ago"
```

Replace placeholders by passing an object:

```tsx
t('time.minutes', { count: 30 })  // "30 minutes"
t('time.ago', { time: '5 hours' }) // "5 hours ago"
```

## Adding a New Language

To add a new language (e.g., French):

1. Create `public/locales/fr.yaml` with all translations
2. Update `frontend/utils/i18n/types.ts`:
   ```ts
   export type Language = 'en' | 'de' | 'es' | 'fr';
   ```
3. Update `frontend/utils/i18n/i18n.ts`:
   ```ts
   const languages: Language[] = ['en', 'de', 'es', 'fr'];
   ```
4. Add display name in `getLanguageName()`:
   ```ts
   const names: Record<Language, string> = {
     en: 'English',
     de: 'Deutsch',
     es: 'Español',
     fr: 'Français',
   };
   ```

## Best Practices

1. **Use descriptive keys**: `tasks.editTask` instead of `task.edit`
2. **Group related translations**: Use sections like `common`, `tasks`, `calendar`
3. **Consistent placeholder names**: Use `{count}`, `{name}`, `{time}` consistently
4. **Keep translations in sync**: Ensure all language files have the same keys
5. **Test with different languages**: Switch languages to ensure UI doesn't break

## Language Detection Priority

The system determines the initial language in this order:

1. **Database**: User's saved language preference (if logged in)
2. **localStorage**: Previously selected language
3. **Browser**: Browser's language setting
4. **Default**: Falls back to English

## Database Persistence

When a user changes their language:
1. The UI updates immediately
2. The preference is saved to localStorage
3. The preference is encrypted and saved to the database (if logged in)
4. On next login, the saved language is automatically restored

