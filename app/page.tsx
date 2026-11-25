'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { listOrders, transcribeAudio, transcribeText } from '@/lib/client/api';
import { saveDraft } from '@/lib/client/draft';
import type { Lang } from '@/lib/contract';
import { inr, round2 } from '@/lib/money';

type RecorderState = 'idle' | 'recording' | 'processing';

const LANG_STORAGE_KEY = 'bhashabill_lang';

const LANGUAGES: { code: Lang; label: string; native: string; sample: string }[] = [
  {
    code: 'kn',
    label: 'Kannada',
    native: 'ಕನ್ನಡ',
    sample: 'ರಮೇಶ್ ಅವರಿಗೆ 2 ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್, 500 ರೂಪಾಯಿ ಅಡ್ವಾನ್ಸ್, ಶುಕ್ರವಾರ ಬೇಕು',
  },
  {
    code: 'hi',
    label: 'Hindi',
    native: 'हिन्दी',
    sample: 'रमेश जी के लिए 2 किलो काजू कतली, 500 एडवांस, शुक्रवार तक',
  },
  {
    code: 'ta',
    label: 'Tamil',
    native: 'தமிழ்',
    sample: 'ரமேஷ் அவர்களுக்கு 2 கிலோ மைசூர் பாக், 500 முன்பணம், வெள்ளி வேண்டும்',
  },
  {
    code: 'en',
    label: 'English',
    native: 'English',
    sample: '2 kg Mysore Pak for Ramesh, 500 rupees advance, due Friday',
  },
];

const PROCESSING_STEPS = ['Transcribing with Sarvam...', 'Building your bill...'];

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<Lang>('kn');
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [showTextBox, setShowTextBox] = useState(false);
  const [textOrder, setTextOrder] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summaryStrip, setSummaryStrip] = useState<{
    outstanding: number;
    pending: number;
    overdue: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore last selected language from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) {
        setLanguage(saved);
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  // Fetch outstanding summary strip once on mount; hide silently on error or empty
  useEffect(() => {
    let active = true;
    listOrders()
      .then((orders) => {
        if (!active || !orders || orders.length === 0) return;
        const pendingOrders = orders.filter((o) => o.status === 'pending');
        const outstanding = round2(pendingOrders.reduce((sum, o) => sum + o.balance, 0));
        const overdue = pendingOrders.filter((o) => o.overdue).length;
        setSummaryStrip({
          outstanding,
          pending: pendingOrders.length,
          overdue,
        });
      })
      .catch(() => {
        // hide silently
      });
    return () => {
      active = false;
    };
  }, []);

  // Cycle processing status text every ~2s while processing
  useEffect(() => {
    if (state !== 'processing') {
      setProcessingStep(0);
      return;
    }
    const id = setInterval(() => {
      setProcessingStep((prev) => (prev + 1) % PROCESSING_STEPS.length);
    }, 2000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  function handleSelectLanguage(code: Lang) {
    setLanguage(code);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      // ignore storage access issues
    }
  }

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

  function handleUseSample() {
    setErrorMsg(null);
    setTextOrder(selectedLang.sample);
    setShowTextBox(true);
    setTimeout(() => textAreaRef.current?.focus(), 0);
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

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-24 sm:pt-7 sm:pb-12">
        {/* Hero heading */}
        <section className="mb-6 max-w-2xl">
          <h1
            className="font-heading text-2xl font-extrabold tracking-tight text-[#7a1f2b] sm:text-3xl"
            style={{ textWrap: 'balance' }}
          >
            Speak the order. Share the bill.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#4a3328] sm:text-base">
            Say it in Kannada, Hindi, Tamil or English. We&apos;ll turn it into an itemised bill.
          </p>
        </section>

        {/* Desktop 2-column grid: 3/5 left, 2/5 right */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start lg:gap-8">
          {/* Left column (3/5) */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            {/* Language selector */}
            <section aria-label="Order language">
              <p className="mb-2 text-xs font-semibold text-[#7a6558]">Language</p>
              <div className="grid grid-cols-2 gap-2.5">
                {LANGUAGES.map((lang) => {
                  const active = lang.code === language;
                  const showEnglishSub = lang.code !== 'en';
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      disabled={state !== 'idle'}
                      onClick={() => handleSelectLanguage(lang.code)}
                      aria-pressed={active}
                      className={`flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] ${
                        active
                          ? 'border-[#7a1f2b] bg-[#7a1f2b] text-white shadow-sm'
                          : 'border-[#f1e3cc] bg-white text-[#2a1a14] hover:border-[#e8892b]'
                      } disabled:opacity-60`}
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="text-base font-bold">{lang.native}</span>
                        {showEnglishSub && (
                          <span
                            className={`mt-0.5 text-xs font-medium ${
                              active ? 'text-[#ffdca8]' : 'text-[#7a6558]'
                            }`}
                          >
                            {lang.label}
                          </span>
                        )}
                      </div>
                      {active && (
                        <svg
                          className="h-5 w-5 shrink-0 text-[#ffdca8]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Mic card with faint radial saffron glow behind it */}
            <div className="bb-mic-glow -mx-2 rounded-3xl p-2">
              <section className="bb-card flex flex-col items-center px-5 py-7">
                {state === 'idle' && (
                  <>
                    <div className="relative flex items-center justify-center">
                      <span
                        aria-hidden="true"
                        className="bb-pulse-ring pointer-events-none absolute h-36 w-36 rounded-full bg-[#e8892b]/35"
                      />
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        aria-label="Tap to speak"
                        className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#f3a142] to-[#e8892b] text-[#7a1f2b] shadow-lg transition hover:from-[#eb9430] hover:to-[#d97b1e] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a1f2b]"
                      >
                        <svg
                          className="h-12 w-12"
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
                      </button>
                    </div>
                    <p className="mt-4 text-base font-bold text-[#7a1f2b]">Tap to speak</p>
                  </>
                )}

                {state === 'recording' && (
                  <>
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      aria-label="Tap to stop recording"
                      className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-8 ring-red-100 transition hover:bg-red-700 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700"
                    >
                      <div className="flex h-9 items-center gap-1.5" aria-hidden="true">
                        <span
                          className="bb-wave-bar h-5 w-1.5 rounded-full bg-white"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="bb-wave-bar h-8 w-1.5 rounded-full bg-white"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="bb-wave-bar h-6 w-1.5 rounded-full bg-white"
                          style={{ animationDelay: '300ms' }}
                        />
                        <span
                          className="bb-wave-bar h-9 w-1.5 rounded-full bg-white"
                          style={{ animationDelay: '100ms' }}
                        />
                        <span
                          className="bb-wave-bar h-5 w-1.5 rounded-full bg-white"
                          style={{ animationDelay: '250ms' }}
                        />
                      </div>
                      <span className="mt-2 font-mono text-lg font-extrabold tracking-tight">
                        {formatTimer(elapsedSec)}
                      </span>
                    </button>
                    <p className="mt-4 text-base font-bold text-red-700">Tap to stop</p>
                  </>
                )}

                {state === 'processing' && (
                  <div
                    className="flex flex-col items-center py-4"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#f1e3cc] bg-[#fff8ec]">
                      <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#e8892b] border-t-[#7a1f2b]" />
                    </div>
                    <p className="mt-4 text-base font-bold text-[#7a1f2b]">
                      {PROCESSING_STEPS[processingStep]}
                    </p>
                  </div>
                )}

                {/* Try saying chip */}
                <button
                  type="button"
                  disabled={state !== 'idle'}
                  onClick={handleUseSample}
                  className="mt-5 min-h-[44px] max-w-full rounded-2xl border border-[#f1e3cc] bg-[#fff8ec] px-4 py-2 text-left text-xs text-[#4a3328] transition hover:border-[#e8892b] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] disabled:opacity-60"
                >
                  <span className="font-bold text-[#7a1f2b]">Try saying: </span>
                  <span>&ldquo;{selectedLang.sample}&rdquo;</span>
                </button>
              </section>
            </div>

            {/* Type the order instead (small underlined text button under the card) */}
            {!showTextBox && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={state !== 'idle'}
                  onClick={() => setShowTextBox(true)}
                  className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-[#7a1f2b] underline underline-offset-4 transition hover:text-[#5b151e] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] disabled:opacity-50"
                >
                  Type the order instead
                </button>
              </div>
            )}

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
            {showTextBox && (
              <form onSubmit={handleTextSubmit} className="bb-card flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="order-text" className="text-sm font-bold text-[#7a1f2b]">
                    Type the order ({selectedLang.label})
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTextBox(false)}
                    className="min-h-[44px] rounded-lg px-2 text-xs font-semibold text-[#7a6558] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
                  >
                    Hide
                  </button>
                </div>
                <textarea
                  ref={textAreaRef}
                  id="order-text"
                  rows={3}
                  value={textOrder}
                  onChange={(e) => setTextOrder(e.target.value)}
                  placeholder={selectedLang.sample}
                  className="w-full rounded-xl border border-[#f1e3cc] bg-[#fff8ec] p-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={state !== 'idle'}
                  className="min-h-[48px] w-full rounded-xl bg-[#7a1f2b] px-4 py-3 text-base font-bold text-white transition hover:bg-[#5b151e] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] disabled:opacity-50"
                >
                  {state === 'processing' ? PROCESSING_STEPS[processingStep] : 'Create Bill from Text'}
                </button>
              </form>
            )}

            {/* Outstanding strip (hidden silently if empty or failed) */}
            {summaryStrip && (
              <Link
                href="/orders"
                className="bb-card flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 text-sm transition hover:border-[#e8892b] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
              >
                <span className="font-semibold text-[#4a3328]">
                  <strong className="font-extrabold text-[#7a1f2b]">
                    {inr(summaryStrip.outstanding)}
                  </strong>{' '}
                  outstanding · {summaryStrip.pending} pending · {summaryStrip.overdue} overdue
                </span>
                <span className="shrink-0 text-xs font-bold text-[#7a1f2b]">View →</span>
              </Link>
            )}
          </div>

          {/* Right column (2/5 on desktop): How it works card */}
          <aside className="hidden lg:col-span-2 lg:block">
            <div className="bb-card p-6">
              <h2 className="font-heading text-lg font-extrabold text-[#7a1f2b]">How it works</h2>
              <ol className="mt-4 flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff0d6] text-xs font-extrabold text-[#7a1f2b]">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#2a1a14]">Speak</p>
                    <p className="text-xs leading-relaxed text-[#4a3328]">
                      Record the order in Kannada, Hindi, Tamil or English — or type it in.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff0d6] text-xs font-extrabold text-[#7a1f2b]">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#2a1a14]">Review and edit</p>
                    <p className="text-xs leading-relaxed text-[#4a3328]">
                      Check item quantities, fill any missing rates, and confirm advance &amp; due date.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff0d6] text-xs font-extrabold text-[#7a1f2b]">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#2a1a14]">Share the bill</p>
                    <p className="text-xs leading-relaxed text-[#4a3328]">
                      Send the bilingual bill link on WhatsApp and track payments in Orders.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="mt-6 border-t border-[#f1e3cc] pt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff8ec] px-3 py-1 text-xs font-semibold text-[#4a3328] ring-1 ring-[#f1e3cc]">
                  Powered by Sarvam AI
                </span>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile footer line for Sarvam AI chip */}
        <footer className="mt-6 flex justify-center lg:hidden">
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#7a6558] ring-1 ring-[#f1e3cc]">
            Powered by Sarvam AI
          </span>
        </footer>
      </main>
    </div>
  );
}
