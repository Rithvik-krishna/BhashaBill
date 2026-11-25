import { z } from 'zod';
import type { Extracted, Lang, TtsResponse } from '@/lib/contract';

const LANG_TO_BCP47: Record<Lang, string> = {
  kn: 'kn-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  en: 'en-IN',
};

const SWEET_SHOP_KEYTERMS = [
  'Mysore Pak',
  'Kaju Katli',
  'Motichoor Laddu',
  'Badam Halwa',
  'Dharwad Peda',
  'Lakshmi Sweets',
];

// Strip codec suffixes, e.g. "audio/webm;codecs=opus" -> "audio/webm"
function cleanMime(type: string | undefined): string {
  return (type || 'audio/webm').split(';')[0].trim() || 'audio/webm';
}

export type SarvamErrorCode = 'empty_audio' | 'stt_failed' | 'parse_failed' | 'tts_failed';

export class SarvamError extends Error {
  readonly code: SarvamErrorCode;

  constructor(code: SarvamErrorCode, message: string) {
    super(message);
    this.name = 'SarvamError';
    this.code = code;
  }
}

function getSarvamConfig() {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error('SARVAM_API_KEY is not configured in .env.local.');
  }
  const baseUrl = (process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai').replace(/\/+$/, '');
  const sttModel = process.env.SARVAM_STT_MODEL || 'saaras:v4';
  const chatModel = process.env.SARVAM_CHAT_MODEL || 'sarvam-105b-conversations';
  const ttsModel = process.env.SARVAM_TTS_MODEL || 'bulbul:v4-flash';
  const ttsSpeaker = process.env.SARVAM_TTS_SPEAKER || 'shubh_enhi_ads';
  return { apiKey, baseUrl, sttModel, chatModel, ttsModel, ttsSpeaker };
}

const nullableNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

const extractedItemSchema = z.object({
  name_original: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ?? '').trim()),
  name_english: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ?? '').trim()),
  quantity: z.preprocess((val) => {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, z.number().positive()),
  unit: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : null;
    }),
  rate: nullableNumber.transform((n) => (n !== null && n > 0 ? n : null)),
});

const extractedSchema = z.object({
  customer_name: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : null;
    }),
  items: z.array(extractedItemSchema).default([]),
  advance_paid: nullableNumber.transform((n) => (n !== null && n >= 0 ? n : null)),
  due_date_text: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : null;
    }),
  notes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : null;
    }),
});

export async function transcribeSpeech(audio: File, language: Lang): Promise<string> {
  if (!audio || audio.size === 0) {
    throw new SarvamError('empty_audio', 'Audio recording was empty. Please try speaking again.');
  }

  const { apiKey, baseUrl, sttModel } = getSarvamConfig();

  const form = new FormData();
  const cleanAudio = new File([await audio.arrayBuffer()], audio.name || 'order.webm', {
    type: cleanMime(audio.type),
  });
  form.append('file', cleanAudio);
  form.append('model', sttModel);
  form.append('language_code', LANG_TO_BCP47[language]);
  if (sttModel.startsWith('saaras:')) {
    form.append('mode', 'codemix');
    form.append('keyterms', JSON.stringify(SWEET_SHOP_KEYTERMS));
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: form,
    });
  } catch (err) {
    throw new SarvamError(
      'stt_failed',
      `Could not reach Sarvam speech-to-text: ${err instanceof Error ? err.message : 'network error'}`,
    );
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new SarvamError(
      'stt_failed',
      `Sarvam speech-to-text failed (${res.status}): ${bodyText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { transcript?: string };
  const transcript = (data.transcript ?? '').trim();
  if (!transcript) {
    throw new SarvamError(
      'empty_audio',
      'No speech was detected in the recording. Please speak clearly or type the order.',
    );
  }

  return transcript;
}

function extractJsonObject(raw: string): unknown {
  // Strip any <think>...</think> reasoning block and markdown fences
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Response did not contain a valid JSON object');
  }
}

export async function extractBillFromTranscript(
  transcript: string,
  language: Lang,
): Promise<Extracted> {
  const { apiKey, baseUrl, chatModel } = getSarvamConfig();

  const systemPrompt = [
    'You extract structured festive shop orders from spoken Indian-language transcripts into STRICT JSON.',
    'Return ONLY a single valid JSON object with NO markdown, NO commentary, and NO extra keys.',
    'NEVER compute line totals, grand totals, or balances.',
    'JSON schema:',
    '{',
    '  "customer_name": string | null,',
    '  "items": [',
    '    {',
    '      "name_original": string (item name in the spoken script/language),',
    '      "name_english": string (common English name of the item),',
    '      "quantity": number (positive, default 1 if unspecified),',
    '      "unit": string | null (e.g. "kg", "g", "box", "pcs", or null),',
    '      "rate": number | null (unit price in INR ONLY if explicitly spoken; otherwise MUST be null — never guess or invent a rate)',
    '    }',
    '  ],',
    '  "advance_paid": number | null (INR amount paid as advance if mentioned, else null),',
    '  "due_date_text": string | null (spoken delivery/due date phrase e.g. "ಶುಕ್ರವಾರ (Friday)", else null),',
    '  "notes": string | null',
    '}',
  ].join('\n');

  const userPrompt = `Language: ${language} (${LANG_TO_BCP47[language]})\nTranscript: ${transcript}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: chatModel,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    throw new SarvamError(
      'parse_failed',
      `Could not reach Sarvam extraction API: ${err instanceof Error ? err.message : 'network error'}`,
    );
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new SarvamError(
      'parse_failed',
      `Sarvam extraction failed (${res.status}): ${bodyText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new SarvamError('parse_failed', 'Model returned an empty response while extracting items.');
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = extractJsonObject(content);
  } catch {
    throw new SarvamError(
      'parse_failed',
      'Could not parse structured bill from the transcript. Please edit the text and try again.',
    );
  }

  const validated = extractedSchema.safeParse(parsedRaw);
  if (!validated.success) {
    throw new SarvamError(
      'parse_failed',
      'Extracted bill had an unexpected format. Please edit the text and try again.',
    );
  }

  const items = validated.data.items
    .map((item) => {
      const nameOriginal = item.name_original || item.name_english;
      const nameEnglish = item.name_english || item.name_original;
      return {
        ...item,
        name_original: nameOriginal,
        name_english: nameEnglish,
      };
    })
    .filter((item) => item.name_original.length > 0 || item.name_english.length > 0);

  if (items.length === 0) {
    throw new SarvamError(
      'parse_failed',
      'No items were found in the order. Please clarify the items and try again.',
    );
  }

  return {
    customer_name: validated.data.customer_name,
    items,
    advance_paid: validated.data.advance_paid,
    due_date_text: validated.data.due_date_text,
    notes: validated.data.notes,
  };
}

export async function synthesizeSpeech(text: string, language: Lang): Promise<TtsResponse> {
  const { apiKey, baseUrl, ttsModel, ttsSpeaker } = getSarvamConfig();
  const languageCode = LANG_TO_BCP47[language];

  const body = {
    text: text.slice(0, 500),
    language_code: languageCode,
    model: ttsModel,
    speaker: ttsSpeaker,
    enable_preprocessing: true,
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new SarvamError(
      'tts_failed',
      `Could not reach Sarvam TTS API: ${err instanceof Error ? err.message : 'network error'}`,
    );
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new SarvamError(
      'tts_failed',
      `Sarvam TTS failed (${res.status}): ${bodyText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { audios?: string[]; audio?: string };
  const audioBase64 = data.audios?.[0] ?? data.audio;
  if (!audioBase64) {
    throw new SarvamError('tts_failed', 'Sarvam TTS response did not include audio data.');
  }

  return {
    audio_base64: audioBase64,
    mime: 'audio/wav',
  };
}
