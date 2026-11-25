import { z } from 'zod';
import type { Lang, TranscribeResponse } from '@/lib/contract';
import { langSchema } from '@/lib/server/orders';
import {
  extractBillFromTranscript,
  SarvamError,
  transcribeSpeech,
} from '@/lib/server/sarvam';

export const dynamic = 'force-dynamic';

const jsonInputSchema = z.object({
  text: z.string().trim().min(1, 'Please enter the order text.'),
  language: langSchema.default('kn'),
});

function errorResponse(body: Extract<TranscribeResponse, { ok: false }>, status: number) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  let transcript = '';
  let language: Lang = 'kn';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const rawLang = formData.get('language');
      const parsedLang = langSchema.safeParse(typeof rawLang === 'string' ? rawLang : 'kn');
      language = parsedLang.success ? parsedLang.data : 'kn';

      const audio = formData.get('audio');
      if (!(audio instanceof File) || audio.size === 0) {
        return errorResponse(
          {
            ok: false,
            error: 'empty_audio',
            message: 'Audio recording was empty. Please speak again or type the order.',
          },
          400,
        );
      }

      transcript = await transcribeSpeech(audio, language);
    } else {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return errorResponse(
          {
            ok: false,
            error: 'parse_failed',
            message: 'Invalid JSON request body.',
          },
          400,
        );
      }

      const parsed = jsonInputSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          {
            ok: false,
            error: 'parse_failed',
            message: parsed.error.issues[0]?.message || 'Please provide valid order text.',
          },
          400,
        );
      }

      transcript = parsed.data.text;
      language = parsed.data.language;
    }

    const extracted = await extractBillFromTranscript(transcript, language);
    const response: TranscribeResponse = {
      ok: true,
      transcript,
      extracted,
    };
    return Response.json(response);
  } catch (err) {
    if (err instanceof SarvamError) {
      if (err.code === 'empty_audio') {
        return errorResponse(
          { ok: false, error: 'empty_audio', message: err.message },
          400,
        );
      }
      if (err.code === 'stt_failed') {
        return errorResponse(
          { ok: false, error: 'stt_failed', message: err.message },
          502,
        );
      }
      return errorResponse(
        {
          ok: false,
          error: 'parse_failed',
          transcript: transcript || undefined,
          message: err.message,
        },
        422,
      );
    }

    console.error('[api/transcribe] unexpected error:', err);
    return errorResponse(
      {
        ok: false,
        error: transcript ? 'parse_failed' : 'stt_failed',
        transcript: transcript || undefined,
        message: err instanceof Error ? err.message : 'Unexpected server error',
      },
      500,
    );
  }
}
