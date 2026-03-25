// GST is INCLUDED in product price (price-inclusive model)
// Extract tax from the selling price: tax = price - (price / (1 + rate/100))

export function calculateTax(orderItems, isSameState = true) {
  let totalTax = 0;

  for (const item of orderItems) {
    if (!item.taxable || !item.taxRate) continue;
    const itemTotal = item.price * item.quantity;
    // Extract tax from inclusive price
    const taxAmount = Math.round((itemTotal - (itemTotal / (1 + item.taxRate / 100))) * 100) / 100;
    totalTax += taxAmount;
  }

  totalTax = Math.round(totalTax * 100) / 100;

  const breakdown = {
    totalTax,
    isSameState,
    inclusive: true,
  };

  if (isSameState) {
    breakdown.cgst = Math.round((totalTax / 2) * 100) / 100;
    breakdown.sgst = Math.round((totalTax / 2) * 100) / 100;
    breakdown.igst = 0;
  } else {
    breakdown.cgst = 0;
    breakdown.sgst = 0;
    breakdown.igst = totalTax;
  }

  return { totalTax, breakdown };
}

export function getIsSameState(shippingState) {
  const storeState = (process.env.STORE_STATE || '').toLowerCase().trim();
  const shipState = (shippingState || '').toLowerCase().trim();
  return !storeState || !shipState || storeState === shipState;
}
