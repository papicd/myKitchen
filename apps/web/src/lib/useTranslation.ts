import { useAuth } from './auth';
import srTranslations from '../translations/sr.json';
import enTranslations from '../translations/en.json';

export function useTranslation() {
  const { language } = useAuth();

  const translations = (language === 'en' ? enTranslations : srTranslations) as Record<string, string>;

  function t(key: string, replacements?: Record<string, string | number>): string {
    let text = translations[key] ?? key;

    if (replacements) {
      Object.entries(replacements).forEach(([replacementKey, value]) => {
        text = text.replace(`{{${replacementKey}}}`, String(value));
      });
    }

    return text;
  }

  return { t, language };
}

