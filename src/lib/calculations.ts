// ============================================================
// Calculation Stubs — Business rule formulas
// ============================================================

/**
 * Calculate order line total
 * Formula: lineTotal = unitPrice * quantity
 * Source: F-001.business_rules[6]
 */
export function calculateLineTotal(_unitPrice: number, _quantity: number): number {
  throw new Error('Not implemented');
}

/**
 * Calculate order subtotal from items
 * Formula: subtotal = SUM(OrderItem.lineTotal)
 * Source: F-001.business_rules[6]
 */
export function calculateSubtotal(_lineTotals: number[]): number {
  throw new Error('Not implemented');
}

/**
 * Calculate PPN amount
 * Formula: ppnAmount = (subtotal - discount) * (ppnRate / 100)
 * Source: F-003.business_rules[1]
 */
export function calculatePPN(_subtotal: number, _discountAmount: number, _ppnRate: number): number {
  throw new Error('Not implemented');
}

/**
 * Calculate grand total
 * Formula: grandTotal = (subtotal - discount) + ppnAmount
 * Source: F-003.business_rules[2]
 */
export function calculateGrandTotal(_subtotal: number, _discountAmount: number, _ppnAmount: number): number {
  throw new Error('Not implemented');
}

/**
 * Calculate expected cash for shift
 * Formula: expectedCash = openingBalance + cashSalesTotal - cashRefundsFromVoids
 * Source: F-015.business_rules[9]
 */
export function calculateExpectedCash(
  _openingBalance: number,
  _cashSalesTotal: number,
  _voidTotalAmount: number
): number {
  throw new Error('Not implemented');
}

/**
 * Calculate shift discrepancy
 * Formula: discrepancy = actualCash - expectedCash
 * Source: F-015.business_rules[14]
 */
export function calculateDiscrepancy(_actualCash: number, _expectedCash: number): number {
  throw new Error('Not implemented');
}

/**
 * Calculate discount amount based on discount type
 * Formula:
 *   percentage: discountAmount = subtotal * (discountValue / 100)
 *   fixed_amount: discountAmount = discountValue
 * Source: F-018.business_rules[3]
 */
export function calculateDiscountAmount(
  _subtotal: number,
  _discountType: 'percentage' | 'fixed_amount',
  _discountValue: number
): number {
  throw new Error('Not implemented');
}
