import { writable, derived } from 'svelte/store';
import type { TranslationKey } from './locales/fr';
import fr from './locales/fr';
import en from './locales/en';
import es from './locales/es';
import de from './locales/de';
import it from './locales/it';
import pt from './locales/pt';
import ja from './locales/ja';
import zh from './locales/zh';

export type { TranslationKey };

// All translatable keys
const translations: Record<string, Record<string, string>> = {
  fr,
  en,
  es,
  de,
  it,
  pt,
  ja,
  zh,
};

function getDict(lang: string): Record<string, string> {
  return translations[lang] || translations['en'];
}

export const currentLang = writable('fr');

export const t = derived(currentLang, ($lang) => {
  const dict = getDict($lang);
  const en = translations['en'];
  return (key: TranslationKey): string => dict[key] || en[key] || key;
});

export function setLanguage(lang: string) {
  currentLang.set(lang);
}
