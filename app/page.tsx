'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { transcribeAudio, transcribeText } from '@/lib/client/api';
import { saveDraft } from '@/lib/client/draft';
import type { Lang } from '@/lib/contract';

type RecorderState = 'idle' | 'recording' | 'processing';

const LANGUAGES: { code: Lang; label: string; native: string; hint: string }[] = [
  {
    code: 'kn',
    label: 'Kannada',
    native: 'ಕನ್ನಡ',
    hint: 'ಉದಾ: ರಮೇಶ್ ಅವರಿಗೆ 2 ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್, 500 ಅಡ್ವಾನ್ಸ್, ಶುಕ್ರವಾರ',
  },
  {
    code: 'hi',
    label: 'Hindi',
    native: 'हिन्दी',
    hint: 'उदा: रमेश जी के लिए 2 किलो काजू कतली, 500 एडवांस, शुक्रवार',
  },
  {
    code: 'ta',
    label: 'Tamil',
    native: 'தமிழ்',
    hint: 'எ.கா: ரமேஷ் அவர்களுக்கு 2 கிலோ மைசூர் பாக், 500 முன்பணம்',
  },
  {
    code: 'en',
    label: 'English',
    native: 'English',
    hint: 'e.g. 2 kg Mysore Pak and 1 kg Laddu for Ramesh, 500 advance, Friday',
  },
];

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<Lang>('kn');
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showTextBox, setShowTextBox] = useState(false);
  const [textOrder, setTextOrder] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleStartRecording() {
    setErrorMsg(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Microphone is not supported in this browser. Please type the order below.');
      setShowTextBox(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopTracks();

        const durationMs = Date.now() - startTimeRef.current;
        if (durationMs < 1000) {
          setState('idle');
          setElapsedSec(0);
          setErrorMsg('Recording was too short. Please speak for at least 1 second.');
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        setState('processing');
        try {
          const res = await transcribeAudio(blob, language);
          if (res.ok) {
            saveDraft({
              transcript: res.transcript,
              extracted: res.extracted,
              language,
            });
            router.push('/review');
            return;
          }
          setErrorMsg(res.message || 'Could not understand the audio. Please edit or type below.');
          if (res.transcript) setTextOrder(res.transcript);
          setShowTextBox(true);
          setState('idle');
        } catch (err) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Something went wrong while transcribing. Try typing the order below.',
          );
          setShowTextBox(true);
          setState('idle');
        }
      };

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      setState('recording');
      recorder.start();

      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);
    } catch {
      stopTracks();
      setState('idle');
      setErrorMsg('Microphone permission denied or unavailable. Please type the order below.');
      setShowTextBox(true);
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = textOrder.trim();
    if (!trimmed) {
      setErrorMsg('Please type the order first.');
      return;
    }
    setErrorMsg(null);
    setState('processing');
    try {
      const res = await transcribeText(trimmed, language);
      if (res.ok) {
        saveDraft({
          transcript: res.transcript,
          extracted: res.extracted,
          language,
        });
        router.push('/review');
        return;
      }
      setErrorMsg(res.message || 'Could not extract items. Please check the text and try again.');
      setState('idle');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process order.');
      setState('idle');
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8ec]">
      <AppHeader />

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <section className="text-center">
          <h1 className="text-2xl font-extrabold text-[#7a1f2b]">New Order</h1>
          <p className="mt-1 text-sm text-[#6e584f]">
            Speak the customer&apos;s order in any language to create an itemised bill.
          </p>
        </section>

        {/* Language selector */}
        <section aria-label="Order language">
          <p className="mb-2 text-xs font-bold tracking-wide text-[#6e584f] uppercase">
            1. Select Language
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {LANGUAGES.map((lang) => {
              const active = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  disabled={state !== 'idle'}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex min-h-[52px] items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-left transition ${
                    active
                      ? 'border-[#7a1f2b] bg-[#7a1f2b] text-[#fff8ec] shadow-sm'
                      : 'border-[#eadbc8] bg-white text-[#2a1a14] hover:border-[#e8892b]'
                  } disabled:opacity-60`}
                >
                  <span className="text-base font-bold">{lang.native}</span>
                  <span
                    className={`text-xs font-medium ${
                      active ? 'text-[#ffdca8]' : 'text-[#6e584f]'
                    }`}
                  >
                    {lang.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Big Mic Button */}
        <section className="flex flex-col items-center rounded-3xl border border-[#eadbc8] bg-white px-5 py-7 shadow-sm">
          <p className="mb-4 text-xs font-bold tracking-wide text-[#6e584f] uppercase">
            2. Speak the Order
          </p>

          {state === 'idle' && (
            <button
              type="button"
              onClick={handleStartRecording}
              className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-[#e8892b] text-[#2a1a14] shadow-lg ring-8 ring-[#fff0d6] transition active:scale-95 hover:bg-[#d97b1e]"
              aria-label="Start recording order"
            >
              <svg
                className="h-12 w-12 text-[#7a1f2b]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                />
              </svg>
              <span className="mt-2 text-base font-extrabold text-[#7a1f2b]">Tap to Speak</span>
            </button>
          )}

          {state === 'recording' && (
            <button
              type="button"
              onClick={handleStopRecording}
              className="flex h-40 w-40 animate-pulse flex-col items-center justify-center rounded-full bg-[#7a1f2b] text-[#fff8ec] shadow-lg ring-8 ring-[#f8d7da] transition active:scale-95"
              aria-label="Stop recording order"
            >
              <span className="h-7 w-7 rounded-md bg-[#fff8ec]" aria-hidden="true" />
              <span className="mt-2 font-mono text-2xl font-extrabold">
                {formatTimer(elapsedSec)}
              </span>
              <span className="mt-0.5 text-xs font-semibold text-[#ffdca8]">Tap to Stop</span>
            </button>
          )}

          {state === 'processing' && (
            <div
              className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-[#e8892b] bg-[#fff8ec] text-[#7a1f2b]"
              role="status"
              aria-live="polite"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e8892b] border-t-[#7a1f2b]" />
              <span className="mt-3 text-sm font-bold">Extracting bill…</span>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-[#6e584f]">{selectedLang.hint}</p>
        </section>

        {/* Friendly error banner */}
        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* Text-box fallback */}
        <section className="flex flex-col gap-3">
          {!showTextBox ? (
            <button
              type="button"
              disabled={state !== 'idle'}
              onClick={() => setShowTextBox(true)}
              className="min-h-[48px] w-full rounded-2xl border border-[#eadbc8] bg-white px-4 py-3 text-sm font-bold text-[#7a1f2b] transition hover:border-[#e8892b] disabled:opacity-50"
            >
              Type the order instead
            </button>
          ) : (
            <form
              onSubmit={handleTextSubmit}
              className="flex flex-col gap-3 rounded-2xl border border-[#eadbc8] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <label htmlFor="order-text" className="text-sm font-bold text-[#7a1f2b]">
                  Type the order ({selectedLang.label})
                </label>
                <button
                  type="button"
                  onClick={() => setShowTextBox(false)}
                  className="text-xs font-semibold text-[#6e584f] underline"
                >
                  Hide
                </button>
              </div>
              <textarea
                id="order-text"
                rows={3}
                value={textOrder}
                onChange={(e) => setTextOrder(e.target.value)}
                placeholder={selectedLang.hint}
                className="w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] p-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
              />
              <button
                type="submit"
                disabled={state !== 'idle'}
                className="min-h-[48px] w-full rounded-xl bg-[#7a1f2b] px-4 py-3 text-base font-bold text-[#fff8ec] transition hover:bg-[#5b151e] disabled:opacity-50"
              >
                {state === 'processing' ? 'Extracting bill…' : 'Create Bill from Text'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
