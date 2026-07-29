import { useCallback, useMemo } from 'react';
import { useAuth } from './auth';
import srTranslations from '../translations/sr.json';
import enTranslations from '../translations/en.json';

export function useTranslation() {
  const { language } = useAuth();

  const translations = useMemo(
    () => (language === 'en' ? enTranslations : srTranslations) as Record<string, string>,
    [language],
  );

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let text = translations[key] ?? key;

    if (replacements) {
      Object.entries(replacements).forEach(([replacementKey, value]) => {
        text = text.replace(`{{${replacementKey}}}`, String(value));
      });
    }

    return text;
  }, [translations]);

  return { t, language };
}

