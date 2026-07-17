import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: stored ?? 'ja',
  fallbackLng: 'ja',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: 'ja' | 'en') {
  localStorage.setItem('lang', lang);
  i18n.changeLanguage(lang);
}

export default i18n;
