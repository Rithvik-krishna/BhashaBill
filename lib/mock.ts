import type {
  FlagsResponse,
  Lang,
  OrderDetail,
  OrderSummary,
  ReminderResponse,
  SaveOrderRequest,
  SaveOrderResponse,
  TranscribeResponse,
  TtsRequest,
  TtsResponse,
} from './contract';
import { lineAmount, round2, totals } from './money';
import { VENDOR } from './vendor';

export const MOCK_TRANSCRIBE_KANNADA: TranscribeResponse = {
  ok: true,
  transcript:
    'ರಮೇಶ್ ಅವರಿಗೆ ಎರಡು ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್, ಒಂದು ಕೆಜಿ ಲಡ್ಡು, ಐನೂರು ರೂಪಾಯಿ ಅಡ್ವಾನ್ಸ್, ಶುಕ್ರವಾರ ಬೇಕು',
  extracted: {
    customer_name: 'Ramesh',
    items: [
      {
        name_original: 'ಮೈಸೂರು ಪಾಕ್',
        name_english: 'Mysore Pak',
        quantity: 2,
        unit: 'kg',
        rate: 600,
      },
      {
        name_original: 'ಲಡ್ಡು',
        name_english: 'Besan Laddu',
        quantity: 1,
        unit: 'kg',
        rate: null, // Intentionally missing so the review screen highlights it
      },
    ],
    advance_paid: 500,
    due_date_text: 'ಶುಕ್ರವಾರ (Friday)',
    notes: null,
  },
};

function isoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

// 5 realistic orders: 2 paid, 2 pending, 1 overdue; mix of Kannada/Hindi & English names
export const INITIAL_MOCK_ORDERS: OrderDetail[] = [
  {
    id: 'ord-1',
    slug: 'kaveri-diwali-101',
    customer_name: 'Kaveriappa',
    customer_phone: '919845011223',
    total: 1800,
    advance_paid: 500,
    payments_total: 1300,
    balance: 0,
    due_date: isoDateOffset(-2),
    status: 'paid',
    overdue: false,
    created_at: isoDateOffset(-5) + 'T09:30:00.000Z',
    transcript: 'ಕಾವೇರಿಯಪ್ಪ ಅವರಿಗೆ ಮೂರು ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್',
    language: 'kn',
    items: [
      {
        id: 'item-1a',
        name_original: 'ಮೈಸೂರು ಪಾಕ್',
        name_english: 'Mysore Pak',
        quantity: 3,
        unit: 'kg',
        rate: 600,
        amount: 1800,
      },
    ],
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  },
  {
    id: 'ord-2',
    slug: 'rajesh-sharma-102',
    customer_name: 'Rajesh Sharma',
    customer_phone: '919811223344',
    total: 1450,
    advance_paid: 1450,
    payments_total: 0,
    balance: 0,
    due_date: isoDateOffset(-1),
    status: 'paid',
    overdue: false,
    created_at: isoDateOffset(-4) + 'T11:15:00.000Z',
    transcript: 'राजेश शर्मा जी के लिए एक किलो काजू कतली और एक किलो जलेबी',
    language: 'hi',
    items: [
      {
        id: 'item-2a',
        name_original: 'काजू कतली',
        name_english: 'Kaju Katli',
        quantity: 1,
        unit: 'kg',
        rate: 950,
        amount: 950,
      },
      {
        id: 'item-2b',
        name_original: 'जलेबी',
        name_english: 'Jalebi',
        quantity: 1,
        unit: 'kg',
        rate: 500,
        amount: 500,
      },
    ],
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  },
  {
    id: 'ord-3',
    slug: 'ananya-rao-103',
    customer_name: 'Ananya Rao',
    customer_phone: '919900112233',
    total: 1650,
    advance_paid: 500,
    payments_total: 0,
    balance: 1150,
    due_date: isoDateOffset(2),
    status: 'pending',
    overdue: false,
    created_at: isoDateOffset(-1) + 'T14:20:00.000Z',
    transcript: 'ಅನನ್ಯ ರಾವ್ ಅವರಿಗೆ ಎರಡು ಕೆಜಿ ಬಾದಾಮ್ ಹಲ್ವಾ ಮತ್ತು ಒಂದು ಕೆಜಿ ಚಕ್ಕುಲಿ',
    language: 'kn',
    items: [
      {
        id: 'item-3a',
        name_original: 'ಬಾದಾಮ್ ಹಲ್ವಾ',
        name_english: 'Badam Halwa',
        quantity: 1,
        unit: 'kg',
        rate: 850,
        amount: 850,
      },
      {
        id: 'item-3b',
        name_original: 'ಚಕ್ಕುಲಿ',
        name_english: 'Chakli',
        quantity: 2,
        unit: 'kg',
        rate: 400,
        amount: 800,
      },
    ],
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  },
  {
    id: 'ord-4',
    slug: 'meena-devi-104',
    customer_name: 'Meena Devi',
    customer_phone: '919740556677',
    total: 1100,
    advance_paid: 300,
    payments_total: 200,
    balance: 600,
    due_date: isoDateOffset(4),
    status: 'pending',
    overdue: false,
    created_at: isoDateOffset(0) + 'T08:45:00.000Z',
    transcript: 'मीना देवी के लिए दो किलो बेसन लड्डू और एक बॉक्स मोतीचूर',
    language: 'hi',
    items: [
      {
        id: 'item-4a',
        name_original: 'बेसन लड्डू',
        name_english: 'Besan Laddu',
        quantity: 2,
        unit: 'kg',
        rate: 350,
        amount: 700,
      },
      {
        id: 'item-4b',
        name_original: 'मोतीचूर लड्डू',
        name_english: 'Motichoor Laddu',
        quantity: 1,
        unit: 'box',
        rate: 400,
        amount: 400,
      },
    ],
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  },
  {
    id: 'ord-5',
    slug: 'suresh-gowda-105',
    customer_name: 'Suresh Gowda',
    customer_phone: '919880998877',
    total: 2200,
    advance_paid: 500,
    payments_total: 0,
    balance: 1700,
    due_date: isoDateOffset(-3),
    status: 'pending',
    overdue: true,
    created_at: isoDateOffset(-6) + 'T16:10:00.000Z',
    transcript: 'ಸುರೇಶ್ ಗೌಡ ಅವರಿಗೆ ನಾಲ್ಕು ಕೆಜಿ ಹೋಳಿಗೆ ಮತ್ತು ಒಂದು ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್',
    language: 'kn',
    items: [
      {
        id: 'item-5a',
        name_original: 'ಹೋಳಿಗೆ',
        name_english: 'Obbattu / Holige',
        quantity: 4,
        unit: 'kg',
        rate: 400,
        amount: 1600,
      },
      {
        id: 'item-5b',
        name_original: 'ಮೈಸೂರು ಪಾಕ್',
        name_english: 'Mysore Pak',
        quantity: 1,
        unit: 'kg',
        rate: 600,
        amount: 600,
      },
    ],
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  },
];

// In-memory mock store for the current runtime (seeded with the 5 initial orders)
const mockOrders: OrderDetail[] = INITIAL_MOCK_ORDERS.map((o) => ({
  ...o,
  items: o.items.map((item) => ({ ...item })),
}));

function toSummary(o: OrderDetail): OrderSummary {
  return {
    id: o.id,
    slug: o.slug,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    total: o.total,
    advance_paid: o.advance_paid,
    payments_total: o.payments_total,
    balance: o.balance,
    due_date: o.due_date,
    status: o.status,
    overdue: o.overdue,
    created_at: o.created_at,
  };
}

export function mockTranscribe(language: Lang): TranscribeResponse {
  if (language === 'hi') {
    return {
      ok: true,
      transcript: 'सुनीता जी के लिए दो किलो काजू कतली, एक किलो लड्डू, 500 रुपये एडवांस, शुक्रवार तक',
      extracted: {
        customer_name: 'Sunita',
        items: [
          {
            name_original: 'काजू कतली',
            name_english: 'Kaju Katli',
            quantity: 2,
            unit: 'kg',
            rate: 900,
          },
          {
            name_original: 'लड्डू',
            name_english: 'Besan Laddu',
            quantity: 1,
            unit: 'kg',
            rate: null,
          },
        ],
        advance_paid: 500,
        due_date_text: 'शुक्रवार (Friday)',
        notes: null,
      },
    };
  }
  return MOCK_TRANSCRIBE_KANNADA;
}

export function mockSaveOrder(payload: SaveOrderRequest): SaveOrderResponse {
  const id = `ord-${Date.now()}`;
  const slugBase =
    payload.customer_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'order';
  const slug = `${slugBase}-${Math.floor(100 + Math.random() * 900)}`;

  const items = payload.items.map((item, idx) => ({
    ...item,
    id: `item-${id}-${idx}`,
    amount: lineAmount(item.quantity, item.rate),
  }));
  const { total, balance } = totals(items, payload.advance_paid, 0);
  const today = new Date().toISOString().slice(0, 10);
  const status = balance <= 0 ? 'paid' : 'pending';
  const overdue = status === 'pending' && Boolean(payload.due_date && payload.due_date < today);

  mockOrders.unshift({
    id,
    slug,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    total,
    advance_paid: round2(payload.advance_paid),
    payments_total: 0,
    balance,
    due_date: payload.due_date,
    status,
    overdue,
    created_at: new Date().toISOString(),
    transcript: payload.transcript,
    language: payload.language,
    items,
    vendor: { name: VENDOR.name, phone: VENDOR.phone },
  });

  return { id, slug };
}

export function mockListOrders(): OrderSummary[] {
  return mockOrders.map(toSummary);
}

export function mockGetOrderBySlug(slug: string): OrderDetail | null {
  return mockOrders.find((o) => o.slug === slug) ?? null;
}

export function mockRecordPayment(id: string, amount: number): OrderSummary {
  const order = mockOrders.find((o) => o.id === id);
  if (!order) {
    throw new Error('Order not found');
  }
  order.payments_total = round2(order.payments_total + amount);
  order.balance = round2(Math.max(0, order.total - order.advance_paid - order.payments_total));
  order.status = order.balance <= 0 ? 'paid' : 'pending';
  const today = new Date().toISOString().slice(0, 10);
  order.overdue = order.status === 'pending' && Boolean(order.due_date && order.due_date < today);
  return toSummary(order);
}

export function mockSendReminder(id: string): ReminderResponse {
  const order = mockOrders.find((o) => o.id === id);
  if (!order) {
    throw new Error('Order not found');
  }
  const variant: 'polite' | 'firm' = order.overdue ? 'firm' : 'polite';
  const dueStr = order.due_date ?? 'soon';
  const message =
    variant === 'firm'
      ? `Namaste ${order.customer_name}, reminder from ${VENDOR.name}: balance of Rs ${order.balance} was due on ${dueStr}. Please settle at your earliest.`
      : `Namaste ${order.customer_name}! Gentle reminder from ${VENDOR.name}: Rs ${order.balance} is due on ${dueStr}. Thank you!`;
  const digits = (order.customer_phone ?? VENDOR.phone).replace(/\D/g, '');
  const wa_url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  return { variant, message, wa_url };
}

export function mockGetFlags(): FlagsResponse {
  return { tts_readback: true };
}

export function mockTts(_payload: TtsRequest): TtsResponse {
  // Tiny valid silent WAV (44 bytes) in base64 so Audio playback works cleanly in mock mode
  return {
    audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    mime: 'audio/wav',
  };
}
