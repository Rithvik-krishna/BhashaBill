// All money math lives here. Never trust the LLM's arithmetic.

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineAmount = (quantity: number, rate: number) => round2(quantity * rate);

export function totals(
  items: { quantity: number; rate: number | null }[],
  advance = 0,
  paymentsTotal = 0,
) {
  const total = round2(items.reduce((sum, i) => sum + lineAmount(i.quantity, i.rate ?? 0), 0));
  const balance = round2(Math.max(0, total - advance - paymentsTotal));
  return { total, balance };
}

const fmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export const inr = (n: number) => fmt.format(n);
