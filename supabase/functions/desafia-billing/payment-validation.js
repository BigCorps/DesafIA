// Pure validation shared by the Deno Edge Function and offline Node tests.
// Never trust a "paid" status without a valid matching amount in cents.
export function paidAmountCents(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents - n * 100) > 1e-7) return null;
  return cents;
}

export function paymentAmountMatches(reportedAmount, expectedCents) {
  return Number.isSafeInteger(expectedCents)
    && expectedCents > 0
    && paidAmountCents(reportedAmount) === expectedCents;
}
