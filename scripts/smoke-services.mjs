/**
 * Smoke-test external sponsors & DB credentials from .env.local:
 *   node --env-file=.env.local scripts/smoke-services.mjs
 */

const baseUrl = (process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai').replace(/\/+$/, '');

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('[SKIP] Supabase: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('orders').select('id, slug').limit(3);
  if (error) {
    console.error('[FAIL] Supabase:', error.message);
  } else {
    console.log(`[PASS] Supabase: orders table reachable (${data.length} sample rows)`);
  }
}

async function checkFlagsmith() {
  const key = process.env.FLAGSMITH_ENVIRONMENT_KEY;
  if (!key) {
    console.log('[SKIP] Flagsmith: FLAGSMITH_ENVIRONMENT_KEY missing');
    return;
  }
  const { Flagsmith } = await import('flagsmith-nodejs');
  const client = new Flagsmith({ environmentKey: key, requestTimeoutSeconds: 5 });
  try {
    const envFlags = await client.getEnvironmentFlags();
    const tts = envFlags.isFeatureEnabled('tts_readback');
    const templates = envFlags.getFeatureValue('reminder_templates');
    const idFlags = await client.getIdentityFlags('919845011223', {
      is_overdue: true,
      language: 'kn',
      balance: 1700,
    });
    const tone = idFlags.getFeatureValue('reminder_tone_test');
    console.log('[PASS] Flagsmith:', {
      tts_readback: tts,
      reminder_tone_test: tone,
      has_reminder_templates: Boolean(templates),
    });
  } catch (err) {
    console.error('[FAIL] Flagsmith:', err instanceof Error ? err.message : err);
  }
}

async function checkSarvamChat() {
  const apiKey = process.env.SARVAM_API_KEY;
  const model = process.env.SARVAM_CHAT_MODEL || 'sarvam-105b-conversations';
  if (!apiKey) {
    console.log('[SKIP] Sarvam Chat: SARVAM_API_KEY missing');
    return;
  }
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Reply with ONLY valid JSON: {"ok": true}' },
        { role: 'user', content: 'ping' },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[FAIL] Sarvam Chat (${model}, HTTP ${res.status}):`, text.slice(0, 200));
  } else {
    console.log(`[PASS] Sarvam Chat (${model}):`, text.slice(0, 180));
  }
}

async function checkSarvamTts() {
  const apiKey = process.env.SARVAM_API_KEY;
  const model = process.env.SARVAM_TTS_MODEL || 'bulbul:v4-flash';
  const speaker = process.env.SARVAM_TTS_SPEAKER || 'shubh_enhi_ads';
  if (!apiKey) {
    console.log('[SKIP] Sarvam TTS: SARVAM_API_KEY missing');
    return;
  }
  const body = {
    text: 'Namaste, bill ready.',
    language_code: 'en-IN',
    model,
    speaker,
    enable_preprocessing: true,
  };
  const res = await fetch(`${baseUrl}/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[FAIL] Sarvam TTS (${model}, HTTP ${res.status}):`, text.slice(0, 200));
  } else {
    const data = await res.json();
    const b64 = data.audios?.[0] ?? data.audio ?? '';
    console.log(`[PASS] Sarvam TTS (${model}, speaker=${speaker}): audio_base64 length = ${b64.length}`);
  }
}

await checkSupabase();
await checkFlagsmith();
await checkSarvamChat();
await checkSarvamTts();
