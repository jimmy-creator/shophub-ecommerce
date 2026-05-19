import { localizedCurrency } from './i18nHelpers';

// Static export for back-compat (admin/POS/finance code that's not
// translated). Storefront callers should prefer the locale-aware
// `<CurrencySymbol />` component or `localizedCurrency()` helper.
export const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL || '₹';
export const CURRENCY_ICON = import.meta.env.VITE_CURRENCY_ICON || '';

// Locale-aware symbol component — re-evaluates on every render so it
// flips when the user toggles the language switcher.
export function CurrencySymbol({ className = '' }) {
  if (CURRENCY_ICON) {
    return <img src={CURRENCY_ICON} alt={CURRENCY} className={`currency-icon ${className}`} />;
  }
  return <span>{localizedCurrency()}</span>;
}
