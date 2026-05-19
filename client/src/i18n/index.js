/**
 * i18next bootstrap for the storefront.
 *
 * Only initialised when VITE_FEATURE_I18N is on (store4). Other
 * stores never import this — the rest of the app uses plain strings.
 *
 * Locale detection order:
 *   1. localStorage 'pos_locale' (user explicitly switched)
 *   2. navigator.language (browser)
 *   3. fallback to English
 *
 * Applies dir="rtl" + lang="<code>" to <html> on every change and
 * fires a re-render via the LocaleContext provider above the app.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ar from './ar.json';

export const SUPPORTED = ['en', 'ar'];
export const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur']);

// URL-prefix locale detection: /ar/* always wins. This guarantees a
// crawlable, sharable Arabic URL — Googlebot can hit /ar/products/foo
// and see Arabic regardless of any user prefs.
const pathLocale = (() => {
  if (typeof window === 'undefined') return null;
  const p = window.location.pathname;
  return (p === '/ar' || p.startsWith('/ar/')) ? 'ar' : null;
})();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: pathLocale || undefined,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'pos_locale',
      caches: ['localStorage'],
    },
  });

// Apply dir + lang to <html> whenever the locale changes. Doing this
// outside React keeps the body/scrollbar in the right direction on
// hard refreshes too.
function applyDirection(lng) {
  const dir = RTL_LOCALES.has(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
}
applyDirection(i18n.language || 'en');
i18n.on('languageChanged', applyDirection);

// Convenience for non-React code (e.g. product display helpers).
export function pickLocalized(obj, locale = i18n.language, baseKey = 'name') {
  if (!obj) return '';
  const arKey = `${baseKey}Ar`;
  if (locale === 'ar' && obj[arKey]) return obj[arKey];
  return obj[baseKey];
}

export default i18n;
