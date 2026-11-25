'use client';

import { useEffect, useState } from 'react';
import {
  clearShop,
  saveDemoShop,
  saveShop,
  type ShopProfile,
} from '@/lib/client/shop';
import type { Lang } from '@/lib/contract';

const LANG_OPTIONS: { code: Lang; native: string; label: string }[] = [
  { code: 'kn', native: 'ಕನ್ನಡ', label: 'Kannada' },
  { code: 'hi', native: 'हिन्दी', label: 'Hindi' },
  { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
  { code: 'en', native: 'English', label: 'English' },
];

interface ShopSetupProps {
  open: boolean;
  mode: 'onboarding' | 'edit';
  initialShop?: ShopProfile | null;
  onClose?: () => void;
}

function extract10Digits(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return digits.slice(2);
  }
  return digits.slice(-10);
}

export function ShopSetup({ open, mode, initialShop, onClose }: ShopSetupProps) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone10, setPhone10] = useState('');
  const [defaultLang, setDefaultLang] = useState<Lang>('kn');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialShop) {
      setName(initialShop.name);
      setCity(initialShop.city ?? '');
      setPhone10(extract10Digits(initialShop.phone));
      setDefaultLang(initialShop.default_language);
    } else {
      setName('');
      setCity('');
      setPhone10('');
      setDefaultLang('kn');
    }
  }, [open, initialShop]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your shop name.');
      return;
    }
    const digits = phone10.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a 10-digit mobile number.');
      return;
    }
    saveShop({
      name: name.trim(),
      city: city.trim() || null,
      phone: `91${digits}`,
      default_language: defaultLang,
      vendor_key: mode === 'edit' ? initialShop?.vendor_key : undefined,
    });
    onClose?.();
  }

  function handleDemo() {
    saveDemoShop();
    onClose?.();
  }

  function handleSwitchShop() {
    clearShop();
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#2a1a14]/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-setup-title"
    >
      <div className="w-full max-w-md rounded-t-3xl border border-[#f1e3cc] bg-[#fff8ec] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="shop-setup-title"
              className="font-heading text-2xl font-extrabold text-[#7a1f2b]"
            >
              {mode === 'edit' ? 'Shop profile' : 'Set up your shop'}
            </h2>
            <p className="mt-1 text-xs text-[#4a3328]">
              Shown on every customer bill you share. Saved on this device.
            </p>
          </div>
          {mode === 'edit' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-3 text-xs font-bold text-[#7a6558] underline"
            >
              Close
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          <div>
            <label htmlFor="shop-name" className="block text-xs font-bold text-[#4a3328]">
              Shop name *
            </label>
            <input
              id="shop-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sri Ganesh Sweets"
              className="mt-1 min-h-[46px] w-full rounded-xl border border-[#f1e3cc] bg-white px-3.5 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="shop-city" className="block text-xs font-bold text-[#4a3328]">
              City (optional)
            </label>
            <input
              id="shop-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mysuru"
              className="mt-1 min-h-[46px] w-full rounded-xl border border-[#f1e3cc] bg-white px-3.5 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="shop-phone" className="block text-xs font-bold text-[#4a3328]">
              WhatsApp / Phone *
            </label>
            <div className="mt-1 flex min-h-[46px] overflow-hidden rounded-xl border border-[#f1e3cc] bg-white focus-within:border-[#7a1f2b]">
              <span className="flex items-center border-r border-[#f1e3cc] bg-[#fff0d6] px-3 text-sm font-bold text-[#7a1f2b]">
                +91
              </span>
              <input
                id="shop-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone10}
                onChange={(e) => setPhone10(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9845012345"
                className="w-full px-3.5 text-base text-[#2a1a14] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold text-[#4a3328]">Default language</p>
            <div className="grid grid-cols-2 gap-2">
              {LANG_OPTIONS.map((lang) => {
                const active = defaultLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setDefaultLang(lang.code)}
                    className={`flex min-h-[46px] items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                      active
                        ? 'border-[#7a1f2b] bg-[#7a1f2b] text-white'
                        : 'border-[#f1e3cc] bg-white text-[#2a1a14] hover:border-[#e8892b]'
                    }`}
                  >
                    <span className="text-sm font-bold">{lang.native}</span>
                    {lang.code !== 'en' && (
                      <span
                        className={`text-[11px] ${
                          active ? 'text-[#ffdca8]' : 'text-[#7a6558]'
                        }`}
                      >
                        {lang.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-1 min-h-[48px] w-full rounded-2xl bg-[#7a1f2b] px-4 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-[#5b151e] active:scale-[0.98]"
          >
            {mode === 'edit' ? 'Save' : 'Start billing'}
          </button>

          {mode === 'onboarding' ? (
            <button
              type="button"
              onClick={handleDemo}
              className="min-h-[44px] w-full rounded-2xl border border-[#f1e3cc] bg-white px-4 py-2.5 text-sm font-bold text-[#7a1f2b] transition hover:border-[#e8892b]"
            >
              Try the demo shop (Lakshmi Sweets)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSwitchShop}
              className="min-h-[44px] w-full rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              Switch shop
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
