import { randomInt } from 'crypto';
import { z } from 'zod';
import type {
  Lang,
  OrderDetail,
  OrderItem,
  OrderSummary,
  PaymentRequest,
  SaveOrderRequest,
  VendorProfile,
} from '@/lib/contract';
import { lineAmount, round2, totals } from '@/lib/money';
import { DEMO_SHOP } from '@/lib/vendor';

export const langSchema = z.enum(['kn', 'hi', 'ta', 'en']);

export const vendorProfileSchema: z.ZodType<VendorProfile> = z.object({
  name: z.string().trim().min(1, 'Shop name is required'),
  phone: z.string().trim().min(1, 'Shop phone is required'),
  city: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const billItemInputSchema = z.object({
  name_original: z.string().trim().min(1, 'Item original name is required'),
  name_english: z.string().trim().min(1, 'Item English name is required'),
  quantity: z.coerce.number().finite().positive('Quantity must be greater than 0'),
  unit: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  rate: z.coerce.number().finite().positive('Rate must be greater than 0'),
});

export const saveOrderSchema: z.ZodType<SaveOrderRequest> = z.object({
  vendor: vendorProfileSchema,
  vendor_key: z.string().trim().min(1, 'vendor_key is required'),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  customer_phone: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  language: langSchema,
  transcript: z.string().optional().default(''),
  items: z.array(billItemInputSchema).min(1, 'At least one item is required'),
  advance_paid: z.coerce.number().finite().min(0, 'Advance paid cannot be negative').default(0),
  due_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD')
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  due_date_text: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const paymentSchema: z.ZodType<PaymentRequest> = z.object({
  amount: z.coerce.number().finite().positive('Payment amount must be greater than 0'),
});

export interface OrderRow {
  id: string;
  slug: string;
  vendor_key?: string;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  vendor_city?: string | null;
  customer_name: string;
  customer_phone: string | null;
  language: Lang;
  transcript: string;
  total: number | string;
  advance_paid: number | string;
  due_date: string | null;
  due_date_text: string | null;
  status: 'pending' | 'paid';
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  name_original: string;
  name_english: string;
  quantity: number | string;
  unit: string | null;
  rate: number | string;
  amount: number | string;
  sort_order?: number;
}

export interface PaymentRow {
  id?: string;
  order_id?: string;
  amount: number | string;
  created_at?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function todayIstIso(): string {
  // Format YYYY-MM-DD in Asia/Kolkata so overdue checks match Bengaluru local date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function makeSlug(customerName: string): string {
  const base =
    customerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 28) || 'order';

  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += SLUG_ALPHABET[randomInt(0, SLUG_ALPHABET.length)];
  }
  return `${base}-${suffix}`;
}

export function serializeOrderItems(rows: OrderItemRow[]): OrderItem[] {
  return [...rows]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((row) => {
      const quantity = Number(row.quantity);
      const rate = round2(Number(row.rate));
      return {
        id: row.id,
        name_original: row.name_original,
        name_english: row.name_english,
        quantity,
        unit: row.unit,
        rate,
        amount: lineAmount(quantity, rate),
      };
    });
}

export function resolveOrderVendor(order: OrderRow): VendorProfile {
  return {
    name: order.vendor_name?.trim() || DEMO_SHOP.profile.name,
    phone: order.vendor_phone?.trim() || DEMO_SHOP.profile.phone,
    city: order.vendor_city !== undefined ? order.vendor_city : DEMO_SHOP.profile.city,
  };
}

export function buildOrderSummary(
  order: OrderRow,
  items: OrderItemRow[] | null,
  payments: PaymentRow[],
): OrderSummary {
  const advancePaid = round2(Number(order.advance_paid) || 0);
  const paymentsTotal = round2(
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
  );

  let total: number;
  let balance: number;

  if (items && items.length > 0) {
    const computed = totals(
      items.map((i) => ({ quantity: Number(i.quantity), rate: Number(i.rate) })),
      advancePaid,
      paymentsTotal,
    );
    total = computed.total;
    balance = computed.balance;
  } else {
    total = round2(Number(order.total) || 0);
    balance = round2(Math.max(0, total - advancePaid - paymentsTotal));
  }

  const status: 'pending' | 'paid' = balance <= 0 ? 'paid' : 'pending';
  const today = todayIstIso();
  const overdue = status === 'pending' && Boolean(order.due_date && order.due_date < today);

  return {
    id: order.id,
    slug: order.slug,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    total,
    advance_paid: advancePaid,
    payments_total: paymentsTotal,
    balance,
    due_date: order.due_date,
    status,
    overdue,
    created_at: order.created_at,
  };
}

export function buildOrderDetail(
  order: OrderRow,
  items: OrderItemRow[],
  payments: PaymentRow[],
): OrderDetail {
  const summary = buildOrderSummary(order, items, payments);
  return {
    ...summary,
    transcript: order.transcript ?? '',
    language: order.language,
    items: serializeOrderItems(items),
    vendor: resolveOrderVendor(order),
  };
}
