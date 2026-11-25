import type {
  FlagsResponse,
  Lang,
  OrderDetail,
  OrderSummary,
  PaymentRequest,
  ReminderResponse,
  SaveOrderRequest,
  SaveOrderResponse,
  TranscribeResponse,
  TtsRequest,
  TtsResponse,
} from '@/lib/contract';
import {
  mockGetFlags,
  mockGetOrderBySlug,
  mockListOrders,
  mockRecordPayment,
  mockSaveOrder,
  mockSendReminder,
  mockTranscribe,
  mockTts,
} from '@/lib/mock';

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message || body.error || message;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function transcribeAudio(
  audio: Blob | File,
  language: Lang,
): Promise<TranscribeResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 450));
    return mockTranscribe(language);
  }
  const form = new FormData();
  const file =
    audio instanceof File
      ? audio
      : new File([audio], 'order.webm', { type: audio.type || 'audio/webm' });
  form.append('audio', file);
  form.append('language', language);

  const res = await fetch(`${apiBase()}/api/transcribe`, {
    method: 'POST',
    body: form,
  });
  return res.json() as Promise<TranscribeResponse>;
}

export async function transcribeText(
  text: string,
  language: Lang,
): Promise<TranscribeResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 350));
    const mock = mockTranscribe(language);
    if (mock.ok) {
      return { ...mock, transcript: text.trim() || mock.transcript };
    }
    return mock;
  }
  const res = await fetch(`${apiBase()}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  return res.json() as Promise<TranscribeResponse>;
}

export async function saveOrder(payload: SaveOrderRequest): Promise<SaveOrderResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 300));
    return mockSaveOrder(payload);
  }
  const res = await fetch(`${apiBase()}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<SaveOrderResponse>(res);
}

export async function listOrders(): Promise<OrderSummary[]> {
  if (USE_MOCKS) {
    return mockListOrders();
  }
  const res = await fetch(`${apiBase()}/api/orders`, { cache: 'no-store' });
  return readJson<OrderSummary[]>(res);
}

export async function getOrderBySlug(slug: string): Promise<OrderDetail | null> {
  if (USE_MOCKS) {
    return mockGetOrderBySlug(slug);
  }
  const res = await fetch(`${apiBase()}/api/orders/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  return readJson<OrderDetail>(res);
}

export async function recordPayment(
  id: string,
  payload: PaymentRequest,
): Promise<OrderSummary> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 250));
    return mockRecordPayment(id, payload.amount);
  }
  const res = await fetch(`${apiBase()}/api/orders/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<OrderSummary>(res);
}

export async function sendReminder(id: string): Promise<ReminderResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 250));
    return mockSendReminder(id);
  }
  const res = await fetch(`${apiBase()}/api/orders/${encodeURIComponent(id)}/reminder`, {
    method: 'POST',
  });
  return readJson<ReminderResponse>(res);
}

export async function getFlags(): Promise<FlagsResponse> {
  if (USE_MOCKS) {
    return mockGetFlags();
  }
  try {
    const res = await fetch(`${apiBase()}/api/flags`, { cache: 'no-store' });
    if (!res.ok) return { tts_readback: false };
    return (await res.json()) as FlagsResponse;
  } catch {
    return { tts_readback: false };
  }
}

export async function synthesizeTts(payload: TtsRequest): Promise<TtsResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 250));
    return mockTts(payload);
  }
  const res = await fetch(`${apiBase()}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<TtsResponse>(res);
}
