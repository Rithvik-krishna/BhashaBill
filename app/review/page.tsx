'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { saveOrder } from '@/lib/client/api';
import { addDaysIso, formatShortDate, parseDueText } from '@/lib/client/dates';
import { clearDraft, loadDraft } from '@/lib/client/draft';
import { useShop } from '@/lib/client/shop';
import type { BillItemInput, Lang, SaveOrderResponse } from '@/lib/contract';
import { inr, lineAmount, round2, totals } from '@/lib/money';
import { DEMO_SHOP } from '@/lib/vendor';

interface EditableRow {
  key: string;
  name_original: string;
  name_english: string;
  quantity: string;
  unit: string;
  rate: string;
}

interface ValidationIssue {
  fieldId: string;
  message: string;
}

const LANG_NAMES: Record<Lang, string> = {
  kn: 'Kannada',
  hi: 'Hindi',
  ta: 'Tamil',
  en: 'English',
};

const UNIT_OPTIONS = ['kg', 'g', 'pcs', 'box', 'dozen', 'litre', 'packet'];

function makeKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parsePositiveNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeNum(v: string): number {
  if (v.trim() === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return round2(n);
}

function StepIndicator({ active }: { active: 'review' | 'share' }) {
  const steps = [
    { key: 'speak', label: '1. Speak', done: true },
    { key: 'review', label: '2. Review', done: active === 'share' },
    { key: 'share', label: '3. Share', done: false },
  ];

  return (
    <nav aria-label="Order progress" className="mb-4 flex items-center gap-2 text-xs font-bold">
      {steps.map((step, idx) => {
        const isCurrent = step.key === active;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 ${
                isCurrent
                  ? 'bg-[#7a1f2b] text-white'
                  : step.done
                    ? 'bg-[#fff0d6] text-[#7a1f2b]'
                    : 'bg-white text-[#7a6558] ring-1 ring-[#f1e3cc]'
              }`}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <span className="text-[#7a6558]" aria-hidden="true">
                ›
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function ReviewBillPage() {
  const router = useRouter();
  const { shop } = useShop();
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState<Lang>('kn');
  const [transcript, setTranscript] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [advanceStr, setAdvanceStr] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [dueDateText, setDueDateText] = useState<string | null>(null);
  const [parsedHeardIso, setParsedHeardIso] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [savedOrder, setSavedOrder] = useState<SaveOrderResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      router.replace('/new');
      return;
    }
    setLanguage(draft.language);
    setTranscript(draft.transcript);
    setCustomerName(draft.extracted.customer_name ?? '');
    setAdvanceStr(
      draft.extracted.advance_paid !== null && draft.extracted.advance_paid !== undefined
        ? String(draft.extracted.advance_paid)
        : '0',
    );
    const heard = draft.extracted.due_date_text ?? null;
    setDueDateText(heard);
    const parsedIso = parseDueText(heard);
    setParsedHeardIso(parsedIso);
    if (parsedIso) {
      setDueDate(parsedIso);
    }

    const mapped: EditableRow[] = (draft.extracted.items ?? []).map((item) => ({
      key: makeKey(),
      name_original: item.name_original ?? '',
      name_english: item.name_english ?? '',
      quantity: item.quantity ? String(item.quantity) : '1',
      unit: item.unit ?? '',
      rate: item.rate !== null && item.rate !== undefined ? String(item.rate) : '',
    }));
    const finalRows =
      mapped.length > 0
        ? mapped
        : [{ key: makeKey(), name_original: '', name_english: '', quantity: '1', unit: 'kg', rate: '' }];
    setRows(finalRows);
    setReady(true);

    // Autofocus the first missing rate on arrival
    const firstMissing = finalRows.find((r) => parsePositiveNum(r.rate) === null);
    if (firstMissing) {
      setTimeout(() => {
        const el =
          document.getElementById(`rate-desktop-${firstMissing.key}`) ||
          document.getElementById(`rate-mobile-${firstMissing.key}`);
        if (el && el.offsetParent !== null) {
          el.focus();
        } else {
          // Fallback if desktop/mobile hidden check differs
          const desktopEl = document.getElementById(`rate-desktop-${firstMissing.key}`);
          const mobileEl = document.getElementById(`rate-mobile-${firstMissing.key}`);
          (desktopEl && desktopEl.offsetParent !== null ? desktopEl : mobileEl)?.focus();
        }
      }, 60);
    }
  }, [router]);

  const parsedForTotals = rows.map((r) => ({
    quantity: parsePositiveNum(r.quantity) ?? 0,
    rate: parsePositiveNum(r.rate),
  }));
  const advanceVal = parseNonNegativeNum(advanceStr);
  const { total, balance } = totals(parsedForTotals, advanceVal, 0);

  // Build ordered validation issues
  const validationIssues: ValidationIssue[] = [];
  if (!customerName.trim()) {
    validationIssues.push({ fieldId: 'customer-name', message: 'Enter customer name' });
  }
  rows.forEach((r, idx) => {
    const label = r.name_english.trim() || r.name_original.trim() || `Item #${idx + 1}`;
    if (!r.name_english.trim() && !r.name_original.trim()) {
      validationIssues.push({
        fieldId: `name-mobile-${r.key}`,
        message: `Enter a name for Item #${idx + 1}`,
      });
    }
    if (parsePositiveNum(r.quantity) === null) {
      validationIssues.push({
        fieldId: `qty-mobile-${r.key}`,
        message: `Enter a valid quantity for ${label}`,
      });
    }
    if (parsePositiveNum(r.rate) === null) {
      validationIssues.push({
        fieldId: `rate-mobile-${r.key}`,
        message: `Enter a rate for ${label}`,
      });
    }
  });
  if (total > 0 && advanceVal > total) {
    validationIssues.push({
      fieldId: 'advance-paid',
      message: 'Advance is more than the total',
    });
  }

  function focusField(fieldId: string) {
    // Handle responsive desktop vs mobile duplicate IDs cleanly
    let el = document.getElementById(fieldId);
    if (fieldId.startsWith('rate-mobile-') || fieldId.startsWith('qty-mobile-') || fieldId.startsWith('name-mobile-')) {
      const desktopId = fieldId.replace('-mobile-', '-desktop-');
      const desktopEl = document.getElementById(desktopId);
      if (desktopEl && desktopEl.offsetParent !== null) {
        el = desktopEl;
      }
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  }

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: makeKey(), name_original: '', name_english: '', quantity: '1', unit: 'kg', rate: '' },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function handleReRecord() {
    clearDraft();
    router.push('/new');
  }

  async function handleSave() {
    setSaveError(null);
    if (validationIssues.length > 0) {
      setShowIssues(true);
      focusField(validationIssues[0].fieldId);
      return;
    }

    const items: BillItemInput[] = rows.map((r) => {
      const qty = parsePositiveNum(r.quantity)!;
      const rate = parsePositiveNum(r.rate)!;
      const english = r.name_english.trim() || r.name_original.trim();
      const original = r.name_original.trim() || r.name_english.trim();
      return {
        name_original: original,
        name_english: english,
        quantity: qty,
        unit: r.unit.trim() || null,
        rate,
      };
    });

    setSaving(true);
    try {
      const res = await saveOrder({
        vendor: shop ? { name: shop.name, phone: shop.phone, city: shop.city } : DEMO_SHOP.profile,
        vendor_key: shop ? shop.vendor_key : DEMO_SHOP.vendor_key,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        language,
        transcript: transcript.trim(),
        items,
        advance_paid: advanceVal,
        due_date: dueDate || null,
        due_date_text: dueDateText,
      });
      clearDraft();
      setSavedOrder(res);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#fff8ec]">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-[#7a6558]">
          Loading draft…
        </main>
      </div>
    );
  }

  if (savedOrder) {
    const publicPath = `/b/${savedOrder.slug}`;
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const fullUrl = `${origin}${publicPath}`;
    const shopName = shop?.name ?? DEMO_SHOP.profile.name;
    const waText = `Namaste ${customerName.trim()}, here is your bill from ${shopName}: Total ${inr(total)}, Balance due ${inr(balance)}. View bill: ${fullUrl}`;
    const phoneDigits = customerPhone.replace(/\D/g, '');
    const waUrl = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;

    async function handleCopy() {
      try {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }

    return (
      <div className="min-h-screen bg-[#fff8ec]">
        <AppHeader />
        <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 pb-24 sm:pb-12">
          <StepIndicator active="share" />
          <div className="bb-card border-emerald-300 p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              ✓
            </div>
            <h1 className="font-heading text-2xl font-extrabold text-[#7a1f2b]">Bill Saved!</h1>
            <p className="mt-1 text-sm text-[#4a3328]">
              Bill for <strong className="text-[#2a1a14]">{customerName}</strong> • Balance{' '}
              <strong className="text-[#7a1f2b]">{inr(balance)}</strong>
            </p>

            <div className="mt-5 rounded-2xl border border-[#f1e3cc] bg-[#fff8ec] p-3 text-left">
              <p className="text-xs font-bold text-[#7a6558] uppercase">Public Bill Link</p>
              <Link
                href={publicPath}
                className="mt-1 block break-all text-sm font-bold text-[#7a1f2b] underline"
              >
                {fullUrl}
              </Link>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#25D366] px-4 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-[#1fb858]"
              >
                Share on WhatsApp
              </a>

              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[48px] w-full rounded-2xl border-2 border-[#7a1f2b] bg-white px-4 py-3 text-base font-bold text-[#7a1f2b] transition hover:bg-[#fff8ec]"
              >
                {copied ? 'Link Copied!' : 'Copy Link'}
              </button>

              <Link
                href={publicPath}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#e8892b] px-4 py-3 text-base font-bold text-[#2a1a14] transition hover:bg-[#d97b1e]"
              >
                Open Public Bill
              </Link>

              <Link href="/new" className="mt-2 min-h-[44px] py-2 text-sm font-semibold text-[#7a6558] underline">
                Take another order
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8ec]">
      <AppHeader />

      <datalist id="unit-options">
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-44 sm:pb-32 lg:pb-12">
        <StepIndicator active="review" />

        <div className="mb-5 flex items-center justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-[#7a1f2b]">Review Bill</h1>
            <p className="text-xs text-[#4a3328]">
              Check items, fill any missing rates, then Save &amp; Share.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReRecord}
            className="min-h-[44px] rounded-xl border border-[#f1e3cc] bg-white px-4 py-2 text-xs font-bold text-[#7a1f2b] hover:border-[#e8892b]"
          >
            Re-record
          </button>
        </div>

        {/* Desktop 2-column grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start lg:gap-8">
          {/* Left sticky column (2/5): What we heard */}
          <aside className="lg:sticky lg:top-20 lg:col-span-2">
            <section className="bb-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="transcript" className="font-heading text-base font-extrabold text-[#7a1f2b]">
                  What we heard
                </label>
                <span className="rounded-full bg-[#fff0d6] px-2.5 py-0.5 text-xs font-bold text-[#7a1f2b]">
                  {LANG_NAMES[language]}
                </span>
              </div>
              <textarea
                id="transcript"
                rows={4}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#f1e3cc] bg-[#fff8ec] p-3 text-sm leading-relaxed text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-[#fff8ec] px-2.5 py-1 text-[11px] font-semibold text-[#7a6558] ring-1 ring-[#f1e3cc]">
                  Transcribed by Sarvam
                </span>
              </div>
            </section>
          </aside>

          {/* Right column (3/5): Customer, Items, Totals */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            {/* Customer Details & Due Date */}
            <section className="bb-card grid grid-cols-1 gap-3.5 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <label htmlFor="customer-name" className="block text-xs font-bold text-[#4a3328]">
                  Customer Name *
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh"
                  aria-invalid={showIssues && !customerName.trim()}
                  className={`mt-1 min-h-[44px] w-full rounded-xl border px-3 text-base text-[#2a1a14] focus:outline-none ${
                    showIssues && !customerName.trim()
                      ? 'border-red-500 bg-red-50'
                      : 'border-[#f1e3cc] bg-[#fff8ec] focus:border-[#7a1f2b]'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="customer-phone" className="block text-xs font-bold text-[#4a3328]">
                  Phone (optional)
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 919845012345"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[#f1e3cc] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="advance-paid" className="block text-xs font-bold text-[#4a3328]">
                  Advance Paid (₹)
                </label>
                <input
                  id="advance-paid"
                  type="number"
                  min="0"
                  step="any"
                  value={advanceStr}
                  onChange={(e) => setAdvanceStr(e.target.value)}
                  aria-invalid={total > 0 && advanceVal > total}
                  className={`mt-1 min-h-[44px] w-full rounded-xl border px-3 text-base text-[#2a1a14] focus:outline-none ${
                    total > 0 && advanceVal > total
                      ? 'border-red-500 bg-red-50'
                      : 'border-[#f1e3cc] bg-[#fff8ec] focus:border-[#7a1f2b]'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="due-date" className="block text-xs font-bold text-[#4a3328]">
                  Due Date
                </label>
                <input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-[#f1e3cc] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
                />
                {dueDateText && (
                  <p className="mt-1.5 inline-block rounded-full bg-[#fff0d6] px-2.5 py-0.5 text-[11px] font-semibold text-[#7a1f2b]">
                    Heard: {dueDateText}
                    {parsedHeardIso ? ` → ${formatShortDate(parsedHeardIso)}` : ''}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDueDate(addDaysIso(new Date(), 1))}
                    className="min-h-[34px] rounded-full border border-[#f1e3cc] bg-white px-2.5 text-xs font-semibold text-[#4a3328] hover:border-[#e8892b]"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(addDaysIso(new Date(), 3))}
                    className="min-h-[34px] rounded-full border border-[#f1e3cc] bg-white px-2.5 text-xs font-semibold text-[#4a3328] hover:border-[#e8892b]"
                  >
                    In 3 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(addDaysIso(new Date(), 7))}
                    className="min-h-[34px] rounded-full border border-[#f1e3cc] bg-white px-2.5 text-xs font-semibold text-[#4a3328] hover:border-[#e8892b]"
                  >
                    Next week
                  </button>
                </div>
              </div>
            </section>

            {/* Items Section */}
            <section className="bb-card flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-extrabold text-[#7a1f2b]">Items</h2>
                <button
                  type="button"
                  onClick={addRow}
                  className="min-h-[44px] rounded-xl bg-[#fff0d6] px-3.5 py-2 text-xs font-bold text-[#7a1f2b] hover:bg-[#ffe3b3]"
                >
                  + Add Row
                </button>
              </div>

              {/* Desktop Table (>=1024px) */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#f1e3cc] text-[11px] font-bold text-[#7a6558] uppercase">
                      <th className="py-2 pr-2">Original</th>
                      <th className="px-1.5 py-2">English</th>
                      <th className="w-20 px-1.5 py-2">Qty</th>
                      <th className="w-24 px-1.5 py-2">Unit</th>
                      <th className="w-24 px-1.5 py-2">Rate (₹)</th>
                      <th className="w-24 px-1.5 py-2 text-right">Amount</th>
                      <th className="w-10 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f6ebd9]">
                    {rows.map((row) => {
                      const qty = parsePositiveNum(row.quantity) ?? 0;
                      const rate = parsePositiveNum(row.rate);
                      const rateMissing = rate === null;
                      const amount = rate !== null ? lineAmount(qty, rate) : 0;

                      return (
                        <tr key={row.key}>
                          <td className="py-2 pr-2">
                            <input
                              id={`name-desktop-${row.key}`}
                              type="text"
                              value={row.name_original}
                              onChange={(e) => updateRow(row.key, { name_original: e.target.value })}
                              placeholder="Original"
                              className="min-h-[40px] w-full rounded-lg border border-[#f1e3cc] bg-[#fff8ec] px-2.5 text-sm"
                            />
                          </td>
                          <td className="px-1.5 py-2">
                            <input
                              type="text"
                              value={row.name_english}
                              onChange={(e) => updateRow(row.key, { name_english: e.target.value })}
                              placeholder="English"
                              className="min-h-[40px] w-full rounded-lg border border-[#f1e3cc] bg-[#fff8ec] px-2.5 text-sm"
                            />
                          </td>
                          <td className="px-1.5 py-2">
                            <input
                              id={`qty-desktop-${row.key}`}
                              type="number"
                              min="0.01"
                              step="any"
                              value={row.quantity}
                              onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                              className="min-h-[40px] w-full rounded-lg border border-[#f1e3cc] bg-[#fff8ec] px-2 text-sm"
                            />
                          </td>
                          <td className="px-1.5 py-2">
                            <input
                              type="text"
                              list="unit-options"
                              value={row.unit}
                              onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                              placeholder="kg"
                              className="min-h-[40px] w-full rounded-lg border border-[#f1e3cc] bg-[#fff8ec] px-2 text-sm"
                            />
                          </td>
                          <td className="px-1.5 py-2">
                            <input
                              id={`rate-desktop-${row.key}`}
                              type="number"
                              min="0.01"
                              step="any"
                              value={row.rate}
                              onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                              placeholder="Rate"
                              aria-invalid={rateMissing}
                              className={`min-h-[40px] w-full rounded-lg border-2 px-2 text-sm font-bold focus:outline-none ${
                                rateMissing
                                  ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-400'
                                  : 'border-[#f1e3cc] bg-[#fff8ec] text-[#2a1a14] focus:border-[#7a1f2b]'
                              }`}
                            />
                          </td>
                          <td className="px-1.5 py-2 text-right font-bold text-[#2a1a14]">
                            {rate !== null ? inr(amount) : '—'}
                          </td>
                          <td className="py-2 pl-1 text-right">
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(row.key)}
                                aria-label="Remove item"
                                className="min-h-[36px] rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (<1024px) */}
              <div className="flex flex-col gap-3 lg:hidden">
                {rows.map((row, idx) => {
                  const qty = parsePositiveNum(row.quantity) ?? 0;
                  const rate = parsePositiveNum(row.rate);
                  const rateMissing = rate === null;
                  const amount = rate !== null ? lineAmount(qty, rate) : 0;

                  return (
                    <div
                      key={row.key}
                      className="rounded-xl border border-[#f1e3cc] bg-[#fff8ec]/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#7a6558]">Item #{idx + 1}</span>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(row.key)}
                            className="min-h-[36px] px-2 text-xs font-bold text-red-700 underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4a3328]">
                            Original Name
                          </label>
                          <input
                            id={`name-mobile-${row.key}`}
                            type="text"
                            value={row.name_original}
                            onChange={(e) => updateRow(row.key, { name_original: e.target.value })}
                            placeholder="e.g. ಮೈಸೂರು ಪಾಕ್"
                            className="mt-0.5 min-h-[42px] w-full rounded-lg border border-[#f1e3cc] bg-white px-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4a3328]">
                            English Name
                          </label>
                          <input
                            type="text"
                            value={row.name_english}
                            onChange={(e) => updateRow(row.key, { name_english: e.target.value })}
                            placeholder="e.g. Mysore Pak"
                            className="mt-0.5 min-h-[42px] w-full rounded-lg border border-[#f1e3cc] bg-white px-2.5 text-sm"
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4a3328]">Qty</label>
                          <input
                            id={`qty-mobile-${row.key}`}
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                            className="mt-0.5 min-h-[42px] w-full rounded-lg border border-[#f1e3cc] bg-white px-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4a3328]">Unit</label>
                          <input
                            type="text"
                            list="unit-options"
                            value={row.unit}
                            onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                            placeholder="kg"
                            className="mt-0.5 min-h-[42px] w-full rounded-lg border border-[#f1e3cc] bg-white px-2 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-[11px] font-semibold ${
                              rateMissing ? 'text-red-700' : 'text-[#4a3328]'
                            }`}
                          >
                            Rate (₹) *
                          </label>
                          <input
                            id={`rate-mobile-${row.key}`}
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.rate}
                            onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                            placeholder="Rate"
                            aria-invalid={rateMissing}
                            className={`mt-0.5 min-h-[42px] w-full rounded-lg border-2 px-2 text-sm font-bold focus:outline-none ${
                              rateMissing
                                ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-400'
                                : 'border-[#f1e3cc] bg-white text-[#2a1a14] focus:border-[#7a1f2b]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4a3328]">
                            Amount
                          </label>
                          <div className="mt-0.5 flex min-h-[42px] items-center justify-end rounded-lg bg-[#f6ebd9] px-2 text-sm font-bold text-[#2a1a14]">
                            {rate !== null ? inr(amount) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Larger & clearer Totals Card */}
            <section className="bb-card border-2 border-[#7a1f2b] p-5">
              <div className="flex items-center justify-between text-base text-[#4a3328]">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-extrabold text-[#2a1a14]">{inr(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base text-[#4a3328]">
                <span className="font-semibold">Advance</span>
                <span className="text-lg font-bold text-[#2a1a14]">− {inr(advanceVal)}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t-2 border-[#f1e3cc] pt-3">
                <span className="font-heading text-lg font-extrabold text-[#7a1f2b]">
                  Balance due
                </span>
                <span className="font-heading text-3xl font-black text-[#7a1f2b]">
                  {inr(balance)}
                </span>
              </div>
            </section>

            {saveError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              >
                {saveError}
              </div>
            )}

            {/* Desktop Save & Share + blocking reasons directly beneath */}
            <div className="hidden flex-col gap-2 lg:flex">
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="min-h-[52px] flex-1 rounded-2xl bg-[#7a1f2b] px-5 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-[#5b151e] active:scale-[0.98] disabled:opacity-60"
                >
                  {saving ? 'Saving Bill…' : 'Save & Share'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleReRecord}
                  className="min-h-[52px] rounded-2xl border border-[#f1e3cc] bg-white px-5 py-3 text-base font-bold text-[#7a1f2b] transition hover:border-[#e8892b]"
                >
                  Re-record
                </button>
              </div>
              {validationIssues.length > 0 && (
                <ul className="space-y-0.5 text-xs font-semibold text-red-700">
                  {validationIssues.map((issue) => (
                    <li key={issue.fieldId + issue.message}>• {issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky bottom bar above bottom tab bar (<640px) or at bottom (640-1023px) */}
      <div className="fixed inset-x-0 bottom-[61px] z-20 border-t border-[#f1e3cc] bg-white/95 px-4 py-2.5 shadow-[0_-6px_20px_rgba(42,26,20,0.08)] backdrop-blur-sm sm:bottom-0 sm:pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-[#7a6558]">Total {inr(total)}</p>
            <p className="text-base font-extrabold text-[#7a1f2b]">Due {inr(balance)}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="min-h-[46px] rounded-2xl bg-[#7a1f2b] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#5b151e] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Share'}
          </button>
        </div>
        {validationIssues.length > 0 && (
          <p className="mx-auto mt-1 max-w-5xl truncate text-[11px] font-semibold text-red-700">
            {validationIssues[0].message}
          </p>
        )}
      </div>
    </div>
  );
}
