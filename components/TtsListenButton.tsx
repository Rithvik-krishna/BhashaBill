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
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#e8892b] px-4 py-2 text-sm font-extrabold text-[#2a1a14] shadow-sm transition hover:bg-[#d97b1e] disabled:opacity-60"
      >
        <span aria-hidden="true">{playing ? '⏹' : '🔊'}</span>
        <span>{loading ? 'Loading…' : playing ? 'Stop' : 'Listen'}</span>
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
