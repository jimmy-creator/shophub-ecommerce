export const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL || '₹';
export const CURRENCY_ICON = import.meta.env.VITE_CURRENCY_ICON || '';

export function CurrencySymbol({ className = '' }) {
  if (CURRENCY_ICON) {
    return <img src={CURRENCY_ICON} alt={CURRENCY} className={`currency-icon ${className}`} />;
  }
  return <span>{CURRENCY}</span>;
}
