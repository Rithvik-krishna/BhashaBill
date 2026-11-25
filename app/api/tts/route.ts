import { z } from 'zod';
import { getPublicFlags } from '@/lib/server/flagsmith';
import { langSchema } from '@/lib/server/orders';
import { SarvamError, synthesizeSpeech } from '@/lib/server/sarvam';

export const dynamic = 'force-dynamic';

const ttsRequestSchema = z.object({
  text: z.string().trim().min(1, 'Text is required for speech synthesis.'),
  language: langSchema.default('en'),
});

export async function POST(req: Request) {
  const flags = await getPublicFlags();
  if (!flags.tts_readback) {
    return Response.json(
      { message: 'TTS readback is currently disabled by feature flag.' },
      { status: 403 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = ttsRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message || 'Invalid TTS payload.' },
      { status: 400 },
    );
  }

  try {
    const audio = await synthesizeSpeech(parsed.data.text, parsed.data.language);
    return Response.json(audio);
  } catch (err) {
    if (err instanceof SarvamError) {
      return Response.json({ message: err.message }, { status: 502 });
    }
    console.error('[api/tts POST] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'TTS synthesis failed.' },
      { status: 500 },
    );
  }
}
