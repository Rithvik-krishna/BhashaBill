/**
 * End-to-end smoke test against a running BhashaBill Next.js server:
 *   node scripts/smoke-api.mjs [http://localhost:3000]
 */

const BASE = (process.argv[2] || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

async function req(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

console.log(`Smoke-testing BhashaBill API at ${BASE}\n`);

// 1. Health check
const health = await req('/api/health');
console.log('1. GET /api/health ->', health.status, health.json);
assert(health.ok && health.json?.ok === true, 'Health check must return ok: true');

// 2. Flags check
const flags = await req('/api/flags');
console.log('2. GET /api/flags ->', flags.status, flags.json);
assert(flags.ok && typeof flags.json?.tts_readback === 'boolean', 'Flags must return boolean tts_readback');

// 3. Create order (with deliberate server-side money recomputation check)
const created = await req('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_name: 'Smoke Test Customer',
    customer_phone: '919845099999',
    language: 'kn',
    transcript: '2 kg Mysore Pak at 600, 1 kg Laddu at 400, 500 advance',
    items: [
      { name_original: 'ಮೈಸೂರು ಪಾಕ್', name_english: 'Mysore Pak', quantity: 2, unit: 'kg', rate: 600 },
      { name_original: 'ಲಡ್ಡು', name_english: 'Laddu', quantity: 1, unit: 'kg', rate: 400 },
    ],
    advance_paid: 500,
    due_date: '2026-11-28',
    due_date_text: 'Friday',
    // Client-sent bogus totals (must be ignored by server)
    total: 1,
    balance: 1,
  }),
});
console.log('3. POST /api/orders ->', created.status, created.json);
assert(created.status === 201 && created.json?.id && created.json?.slug, 'Create order must return id + slug');

const { id, slug } = created.json;

// 4. Fetch by slug
const detail = await req(`/api/orders/${encodeURIComponent(slug)}`);
console.log('4. GET /api/orders/[slug] ->', detail.status, {
  total: detail.json?.total,
  balance: detail.json?.balance,
  items: detail.json?.items?.length,
});
assert(detail.ok && detail.json.total === 1600 && detail.json.balance === 1100, 'Server must recompute total=1600, balance=1100');

// 5. List orders
const list = await req('/api/orders');
console.log('5. GET /api/orders ->', list.status, `(${Array.isArray(list.json) ? list.json.length : 0} orders)`);
assert(list.ok && Array.isArray(list.json) && list.json.some((o) => o.id === id), 'Created order must appear in list');

// 6. Record partial payment
const pay1 = await req(`/api/orders/${encodeURIComponent(id)}/payments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 600 }),
});
console.log('6. POST /api/orders/[id]/payments (600) ->', pay1.status, {
  payments_total: pay1.json?.payments_total,
  balance: pay1.json?.balance,
  status: pay1.json?.status,
});
assert(pay1.ok && pay1.json.balance === 500 && pay1.json.status === 'pending', 'Balance should be 500 and pending');

// 7. Send reminder
const reminder = await req(`/api/orders/${encodeURIComponent(id)}/reminder`, { method: 'POST' });
console.log('7. POST /api/orders/[id]/reminder ->', reminder.status, reminder.json);
assert(
  reminder.ok &&
    (reminder.json.variant === 'polite' || reminder.json.variant === 'firm') &&
    typeof reminder.json.wa_url === 'string' &&
    reminder.json.wa_url.startsWith('https://wa.me/'),
  'Reminder must return variant, message, and wa_url',
);

// 8. Record final payment -> status becomes paid
const pay2 = await req(`/api/orders/${encodeURIComponent(id)}/payments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 500 }),
});
console.log('8. POST /api/orders/[id]/payments (500) ->', pay2.status, {
  payments_total: pay2.json?.payments_total,
  balance: pay2.json?.balance,
  status: pay2.json?.status,
});
assert(pay2.ok && pay2.json.balance === 0 && pay2.json.status === 'paid', 'Order should flip to paid');

console.log('\nAll core API smoke checks PASSED!');
