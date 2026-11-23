import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import si from './locales/si.json';

export type Language = 'en' | 'si';

export function languageOf(value?: string): Language {
  return value?.split('-')[0] === 'si' ? 'si' : 'en';
}

const storageKey = 'zestora.language';

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'en' || saved === 'si') return saved;
  } catch {
    // Browser settings may prevent local storage access.
  }

  return languageOf(navigator.language);
}

function applyLanguage(value: string) {
  const language = languageOf(value);
  document.documentElement.lang = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // The language still applies for the current page.
  }
}

i18n.on('languageChanged', applyLanguage);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si } },
  lng: initialLanguage(),
  supportedLngs: ['en', 'si'],
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
