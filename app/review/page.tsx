'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { saveOrder } from '@/lib/client/api';
import { clearDraft, loadDraft } from '@/lib/client/draft';
import type { BillItemInput, Lang, SaveOrderResponse } from '@/lib/contract';
import { inr, lineAmount, round2, totals } from '@/lib/money';
import { VENDOR } from '@/lib/vendor';

interface EditableRow {
  key: string;
  name_original: string;
  name_english: string;
  quantity: string;
  unit: string;
  rate: string; // empty string => missing rate
}

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

export default function ReviewBillPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState<Lang>('kn');
  const [transcript, setTranscript] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [advanceStr, setAdvanceStr] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [dueDateText, setDueDateText] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOrder, setSavedOrder] = useState<SaveOrderResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      router.replace('/');
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
    setDueDateText(draft.extracted.due_date_text ?? null);

    const mapped: EditableRow[] = (draft.extracted.items ?? []).map((item) => ({
      key: makeKey(),
      name_original: item.name_original ?? '',
      name_english: item.name_english ?? '',
      quantity: item.quantity ? String(item.quantity) : '1',
      unit: item.unit ?? '',
      rate: item.rate !== null && item.rate !== undefined ? String(item.rate) : '',
    }));
    setRows(
      mapped.length > 0
        ? mapped
        : [{ key: makeKey(), name_original: '', name_english: '', quantity: '1', unit: 'kg', rate: '' }],
    );
    setReady(true);
  }, [router]);

  const parsedForTotals = rows.map((r) => ({
    quantity: parsePositiveNum(r.quantity) ?? 0,
    rate: parsePositiveNum(r.rate),
  }));
  const advanceVal = parseNonNegativeNum(advanceStr);
  const { total, balance } = totals(parsedForTotals, advanceVal, 0);

  const missingRateCount = rows.filter((r) => parsePositiveNum(r.rate) === null).length;

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
    router.push('/');
  }

  async function handleSave() {
    setSaveError(null);
    if (!customerName.trim()) {
      setSaveError('Please enter the customer name.');
      return;
    }
    if (rows.length === 0) {
      setSaveError('Please add at least one item.');
      return;
    }
    if (missingRateCount > 0) {
      setSaveError('Please fill in the rate (₹) for every highlighted row before saving.');
      return;
    }

    const items: BillItemInput[] = [];
    for (const r of rows) {
      const qty = parsePositiveNum(r.quantity);
      const rate = parsePositiveNum(r.rate);
      if (!qty || !rate) {
        setSaveError('Every item must have a valid quantity and rate.');
        return;
      }
      const english = r.name_english.trim() || r.name_original.trim();
      const original = r.name_original.trim() || r.name_english.trim();
      if (!english && !original) {
        setSaveError('Every item must have a name.');
        return;
      }
      items.push({
        name_original: original,
        name_english: english,
        quantity: qty,
        unit: r.unit.trim() || null,
        rate,
      });
    }

    setSaving(true);
    try {
      const res = await saveOrder({
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
        <main className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-[#6e584f]">
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
    const waText = `Namaste ${customerName.trim()}, here is your bill from ${VENDOR.name}: Total ${inr(total)}, Balance due ${inr(balance)}. View bill: ${fullUrl}`;
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
        <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
          <div className="rounded-3xl border border-emerald-300 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              ✓
            </div>
            <h1 className="text-2xl font-extrabold text-[#7a1f2b]">Bill Saved!</h1>
            <p className="mt-1 text-sm text-[#6e584f]">
              Bill for <strong className="text-[#2a1a14]">{customerName}</strong> • Balance{' '}
              <strong className="text-[#7a1f2b]">{inr(balance)}</strong>
            </p>

            <div className="mt-5 rounded-2xl border border-[#eadbc8] bg-[#fff8ec] p-3 text-left">
              <p className="text-xs font-bold text-[#6e584f] uppercase">Public Bill Link</p>
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
                className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-[#25D366] px-4 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-[#1fb858]"
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

              <Link
                href="/"
                className="mt-2 text-sm font-semibold text-[#6e584f] underline"
              >
                Take another order
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8ec] pb-12">
      <AppHeader />

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-[#7a1f2b]">Review Bill</h1>
            <p className="text-xs text-[#6e584f]">
              Check items, fill any missing rates, then Save &amp; Share.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReRecord}
            className="min-h-[40px] rounded-xl border border-[#eadbc8] bg-white px-3.5 py-2 text-xs font-bold text-[#7a1f2b] hover:border-[#e8892b]"
          >
            Re-record
          </button>
        </div>

        {/* Editable Transcript */}
        <section className="rounded-2xl border border-[#eadbc8] bg-white p-4 shadow-sm">
          <label htmlFor="transcript" className="block text-xs font-bold text-[#6e584f] uppercase">
            Spoken Order Transcript
          </label>
          <textarea
            id="transcript"
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] p-2.5 text-sm text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
          />
        </section>

        {/* Customer Details */}
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[#eadbc8] bg-white p-4 shadow-sm sm:grid-cols-2">
          <div>
            <label htmlFor="customer-name" className="block text-xs font-bold text-[#6e584f] uppercase">
              Customer Name *
            </label>
            <input
              id="customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ramesh"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="customer-phone" className="block text-xs font-bold text-[#6e584f] uppercase">
              Phone (optional)
            </label>
            <input
              id="customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 919845012345"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="advance-paid" className="block text-xs font-bold text-[#6e584f] uppercase">
              Advance Paid (₹)
            </label>
            <input
              id="advance-paid"
              type="number"
              min="0"
              step="any"
              value={advanceStr}
              onChange={(e) => setAdvanceStr(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="due-date" className="block text-xs font-bold text-[#6e584f] uppercase">
                Due Date
              </label>
              {dueDateText && (
                <span className="rounded-full bg-[#fff0d6] px-2 py-0.5 text-[11px] font-semibold text-[#7a1f2b]">
                  Heard: {dueDateText}
                </span>
              )}
            </div>
            <input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-[#eadbc8] bg-[#fff8ec] px-3 text-base text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none"
            />
          </div>
        </section>

        {/* Editable Items */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#eadbc8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#7a1f2b] uppercase">Items</h2>
            <button
              type="button"
              onClick={addRow}
              className="min-h-[38px] rounded-xl bg-[#fff0d6] px-3 py-1.5 text-xs font-bold text-[#7a1f2b] hover:bg-[#ffe3b3]"
            >
              + Add Row
            </button>
          </div>

          {missingRateCount > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
            >
              {missingRateCount} item{missingRateCount > 1 ? 's' : ''} missing rate — enter rate in
              the red box to save.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {rows.map((row, idx) => {
              const qty = parsePositiveNum(row.quantity) ?? 0;
              const rate = parsePositiveNum(row.rate);
              const rateMissing = rate === null;
              const amount = rate !== null ? lineAmount(qty, rate) : 0;

              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-[#eadbc8] bg-[#fff8ec]/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6e584f]">Item #{idx + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="text-xs font-bold text-red-700 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e584f]">
                        Original Name
                      </label>
                      <input
                        type="text"
                        value={row.name_original}
                        onChange={(e) => updateRow(row.key, { name_original: e.target.value })}
                        placeholder="e.g. ಮೈಸೂರು ಪಾಕ್"
                        className="mt-0.5 min-h-[40px] w-full rounded-lg border border-[#eadbc8] bg-white px-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e584f]">
                        English Name
                      </label>
                      <input
                        type="text"
                        value={row.name_english}
                        onChange={(e) => updateRow(row.key, { name_english: e.target.value })}
                        placeholder="e.g. Mysore Pak"
                        className="mt-0.5 min-h-[40px] w-full rounded-lg border border-[#eadbc8] bg-white px-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e584f]">Qty</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        className="mt-0.5 min-h-[40px] w-full rounded-lg border border-[#eadbc8] bg-white px-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e584f]">Unit</label>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                        placeholder="kg"
                        className="mt-0.5 min-h-[40px] w-full rounded-lg border border-[#eadbc8] bg-white px-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[11px] font-semibold ${
                          rateMissing ? 'text-red-700' : 'text-[#6e584f]'
                        }`}
                      >
                        Rate (₹) *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.rate}
                        onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                        placeholder="Rate"
                        aria-invalid={rateMissing}
                        className={`mt-0.5 min-h-[40px] w-full rounded-lg border-2 px-2 text-sm font-bold focus:outline-none ${
                          rateMissing
                            ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-400'
                            : 'border-[#eadbc8] bg-white text-[#2a1a14] focus:border-[#7a1f2b]'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e584f]">
                        Amount
                      </label>
                      <div className="mt-0.5 flex min-h-[40px] items-center justify-end rounded-lg bg-[#f6ebd9] px-2 text-sm font-bold text-[#2a1a14]">
                        {rate !== null ? inr(amount) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Totals */}
        <section className="rounded-2xl border-2 border-[#7a1f2b] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#6e584f]">
            <span>Total</span>
            <span className="text-base font-bold text-[#2a1a14]">{inr(total)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm text-[#6e584f]">
            <span>Advance Paid</span>
            <span className="font-semibold text-[#2a1a14]">− {inr(advanceVal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#eadbc8] pt-2">
            <span className="text-base font-extrabold text-[#7a1f2b]">Balance Due</span>
            <span className="text-2xl font-extrabold text-[#7a1f2b]">{inr(balance)}</span>
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

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={saving || missingRateCount > 0}
            onClick={handleSave}
            className="min-h-[52px] flex-1 rounded-2xl bg-[#7a1f2b] px-5 py-3 text-base font-extrabold text-[#fff8ec] shadow-sm transition hover:bg-[#5b151e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving Bill…' : 'Save & Share'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleReRecord}
            className="min-h-[52px] rounded-2xl border border-[#eadbc8] bg-white px-5 py-3 text-base font-bold text-[#7a1f2b] transition hover:border-[#e8892b]"
          >
            Re-record
          </button>
        </div>
      </main>
    </div>
  );
}
