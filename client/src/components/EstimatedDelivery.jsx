import { Truck } from 'lucide-react';

/**
 * Estimated-delivery widget shown on the product detail page.
 *
 * Renders today + minDays … today + maxDays as a localised
 * "Get it by DD MMM – DD MMM" line. Skips Fridays for stores that
 * pass `skipFriday` (Kuwait sector); otherwise uses calendar days.
 *
 * Pure presentational: no API call, no inputs. The shipping policy
 * page carries the formal SLA; this is the conversion-helping
 * "Arrives Tuesday" line.
 */
function addBusinessDays(start, days, { skipFriday = false } = {}) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (skipFriday && d.getDay() === 5) continue;
    added++;
  }
  return d;
}

export default function EstimatedDelivery({
  minDays = 2,
  maxDays = 4,
  skipFriday = false,
  freeOverHint = '',
}) {
  const isAr = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  const locale = isAr ? 'ar-KW' : 'en-GB';

  const now = new Date();
  const from = addBusinessDays(now, minDays, { skipFriday });
  const to = addBusinessDays(now, maxDays, { skipFriday });
  const fmt = (d) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const label = isAr ? 'استلامك المتوقع' : 'Get it by';
  const between = isAr ? `${fmt(to)} – ${fmt(from)}` : `${fmt(from)} – ${fmt(to)}`;

  return (
    <div className="s2-eta">
      <div className="s2-eta-row">
        <span className="s2-eta-icon" aria-hidden="true">
          <Truck size={16} strokeWidth={1.8} />
        </span>
        <div className="s2-eta-text">
          <span className="s2-eta-label">{label}</span>
          <strong className="s2-eta-range">{between}</strong>
        </div>
      </div>
      {freeOverHint ? (
        <div className="s2-eta-hint">{freeOverHint}</div>
      ) : null}
    </div>
  );
}
