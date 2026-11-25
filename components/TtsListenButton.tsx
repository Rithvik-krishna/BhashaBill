'use client';

import { useRef, useState } from 'react';
import { synthesizeTts } from '@/lib/client/api';
import type { Lang } from '@/lib/contract';

interface TtsListenButtonProps {
  summaryText: string;
  language: Lang;
}

export function TtsListenButton({ summaryText, language }: TtsListenButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handleListen() {
    setError(null);
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const res = await synthesizeTts({ text: summaryText, language });
      const audio = new Audio(`data:${res.mime};base64,${res.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setError('Could not play audio.');
      };
      setPlaying(true);
      await audio.play();
    } catch (err) {
      setPlaying(false);
      setError(err instanceof Error ? err.message : 'Audio unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleListen}
        disabled={loading}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#e8892b] px-4 py-2 text-sm font-extrabold text-[#7a1f2b] shadow-sm transition hover:bg-[#d97b1e] active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7a1f2b] border-t-transparent" />
        ) : (
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.3}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
            />
          </svg>
        )}
        <span>{loading ? 'Loading…' : playing ? 'Stop' : 'Listen'}</span>
      </button>
      {error && <span className="text-xs font-medium text-[#ffdca8]">{error}</span>}
    </div>
  );
}
