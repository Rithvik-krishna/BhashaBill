// SOURCE OF TRUTH for every request/response shape. Frontend and backend both import from here.
// Do not change without telling your teammate.

export type Lang = 'kn' | 'hi' | 'ta' | 'en';

export interface VendorProfile {
  name: string;
  phone: string;
  city: string | null;
}

export interface ExtractedItem {
  name_original: string;
  name_english: string;
  quantity: number;
  unit: string | null;
  rate: number | null; // null => review screen highlights it and blocks Save
}

export interface Extracted {
  customer_name: string | null;
  items: ExtractedItem[];
  advance_paid: number | null;
  due_date_text: string | null; // e.g. "Friday" / "ಶುಕ್ರವಾರ"; real date is picked on the review screen
  notes: string | null;
}

// POST /api/transcribe
//   multipart/form-data: audio (File), language (Lang)
//   OR application/json: { text: string, language: Lang }  (text-box fallback, skips STT)
export type TranscribeResponse =
  | { ok: true; transcript: string; extracted: Extracted }
  | {
      ok: false;
      error: 'empty_audio' | 'stt_failed' | 'parse_failed';
      transcript?: string;
      message: string;
    };

export interface BillItemInput {
  name_original: string;
  name_english: string;
  quantity: number;
  unit: string | null;
  rate: number; // required to save
}

// POST /api/orders   (server recomputes every amount/total/balance; client totals are ignored)
export interface SaveOrderRequest {
  vendor: VendorProfile;
  vendor_key: string;
  customer_name: string;
  customer_phone: string | null;
  language: Lang;
  transcript: string;
  items: BillItemInput[];
  advance_paid: number;
  due_date: string | null; // ISO yyyy-mm-dd
  due_date_text: string | null;
}
export interface SaveOrderResponse {
  id: string;
  slug: string;
}

export interface OrderSummary {
  id: string;
  slug: string;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  advance_paid: number;
  payments_total: number;
  balance: number; // total - advance_paid - payments_total
  due_date: string | null;
  status: 'pending' | 'paid';
  overdue: boolean; // pending and due_date < today
  created_at: string;
}

export interface OrderItem extends BillItemInput {
  id: string;
  amount: number; // quantity * rate, computed server-side
}

// GET /api/orders -> OrderSummary[]  (REQUIRES ?vendor_key=; returns only that shop's orders; 400 if missing.)
// GET /api/orders/[slug] -> OrderDetail
export interface OrderDetail extends OrderSummary {
  transcript: string;
  language: Lang;
  items: OrderItem[];
  vendor: VendorProfile;
}

// POST /api/orders/[id]/payments -> OrderSummary
export interface PaymentRequest {
  amount: number;
}

// POST /api/orders/[id]/reminder -> ReminderResponse
export interface ReminderResponse {
  variant: 'polite' | 'firm';
  message: string;
  wa_url: string; // https://wa.me/<digits>?text=<encoded>
}

// GET /api/flags -> FlagsResponse
export interface FlagsResponse {
  tts_readback: boolean;
}

// POST /api/tts  body: { text, language } -> TtsResponse (only works when tts_readback flag is on)
export interface TtsRequest {
  text: string;
  language: Lang;
}
export interface TtsResponse {
  audio_base64: string;
  mime: string;
}
