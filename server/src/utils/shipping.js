// Shipping rate calculation
// Configurable via .env — defaults provided

import { areaCharge } from '../data/kuwaitDelivery.js';

export function calculateShipping(subtotal, itemCount, shippingState, shippingCity) {
  const freeThreshold = parseFloat(process.env.SHIPPING_FREE_ABOVE || '500');
  const flatRate = parseFloat(process.env.SHIPPING_FLAT_RATE || '49');
  const perItemRate = parseFloat(process.env.SHIPPING_PER_ITEM || '0');
  const expressRate = parseFloat(process.env.SHIPPING_EXPRESS_RATE || '99');
  // Delivery-time text shown at checkout. Env-configurable per store
  // (store4/Kuwait does fast local delivery, not multi-day courier).
  // *_AR carries the Arabic version for the /ar checkout (empty → English).
  const standardDays = process.env.SHIPPING_STANDARD_DAYS || '5-7 business days';
  const expressDays = process.env.SHIPPING_EXPRESS_DAYS || '1-2 business days';
  const standardDaysAr = process.env.SHIPPING_STANDARD_DAYS_AR || '';
  const expressDaysAr = process.env.SHIPPING_EXPRESS_DAYS_AR || '';

  // store4 (Kuwait): area-based delivery charge, single option (no express).
  // Triggers only when the governorate+area match the Kuwait table.
  const kw = areaCharge(shippingState, shippingCity);
  if (kw != null) {
    const free = subtotal >= freeThreshold;
    return {
      standard: { rate: free ? 0 : kw, label: free ? 'Free Delivery' : 'Delivery', days: standardDays, daysAr: standardDaysAr },
      freeThreshold,
    };
  }

  // Free shipping above threshold
  if (subtotal >= freeThreshold) {
    return {
      standard: { rate: 0, label: 'Free Shipping', days: standardDays, daysAr: standardDaysAr },
      express: { rate: expressRate, label: 'Express Shipping', days: expressDays, daysAr: expressDaysAr },
      freeThreshold,
    };
  }

  const standardRate = flatRate + (perItemRate * (itemCount - 1));

  return {
    standard: { rate: Math.round(standardRate * 100) / 100, label: 'Standard Shipping', days: standardDays, daysAr: standardDaysAr },
    express: { rate: expressRate, label: 'Express Shipping', days: expressDays, daysAr: expressDaysAr },
    freeThreshold,
    amountForFree: Math.round((freeThreshold - subtotal) * 100) / 100,
  };
}
