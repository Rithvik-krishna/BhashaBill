'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { listOrders, recordPayment, sendReminder } from '@/lib/client/api';
import { useShop } from '@/lib/client/shop';
import type { OrderSummary, ReminderResponse } from '@/lib/contract';
import { inr, round2 } from '@/lib/money';

type FilterTab = 'all' | 'pending' | 'overdue' | 'paid';

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StatusChip({ order }: { order: OrderSummary }) {
  if (order.status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
        Paid
      </span>
    );
  }
  if (order.overdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
      Pending
    </span>
  );
}

function sortOrders(list: OrderSummary[]): OrderSummary[] {
  return [...list].sort((a, b) => {
    const rank = (o: OrderSummary) => (o.overdue ? 0 : o.status === 'pending' ? 1 : 2);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;

    if (ra === 1) {
      // Pending: sort by due_date ascending (nulls last)
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

export default function OrdersDashboardPage() {
  const { shop, ready: shopReady } = useShop();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reminderInfo, setReminderInfo] = useState<Record<string, ReminderResponse>>({});

  const refreshOrders = useCallback(async () => {
    if (!shop) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await listOrders(shop.vendor_key);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (shopReady) refreshOrders();
  }, [shopReady, refreshOrders]);

  const totalOutstanding = round2(
    orders.reduce((sum, o) => (o.status === 'pending' ? sum + o.balance : sum), 0),
  );

  const counts = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending' && !o.overdue).length;
    const overdue = orders.filter((o) => o.overdue).length;
    const paid = orders.filter((o) => o.status === 'paid').length;
    return { all: orders.length, pending: pending + overdue, overdue, paid };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = orders.filter((o) => {
      if (filter === 'pending' && o.status !== 'pending') return false;
      if (filter === 'overdue' && !o.overdue) return false;
      if (filter === 'paid' && o.status !== 'paid') return false;
      if (q && !o.customer_name.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortOrders(filtered);
  }, [orders, filter, search]);

  async function handlePayment(order: OrderSummary) {
    const raw = paymentInputs[order.id] ?? String(order.balance);
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(`Enter a valid payment amount for ${order.customer_name}.`);
      return;
    }
    setError(null);
    setBusyId(order.id);
    try {
      await recordPayment(order.id, { amount });
      setPaymentInputs((prev) => ({ ...prev, [order.id]: '' }));
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReminder(order: OrderSummary) {
    setError(null);
    setBusyId(order.id);
    try {
      const res = await sendReminder(order.id);
      setReminderInfo((prev) => ({ ...prev, [order.id]: res }));
      window.open(res.wa_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate reminder.');
    } finally {
      setBusyId(null);
    }
  }

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'paid', label: 'Paid', count: counts.paid },
  ];

  return (
    <div className="min-h-screen bg-[#fff8ec]">
      <AppHeader />

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-5 pb-24 sm:pb-12">
        {/* Summary Header */}
        <section className="bb-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-[#7a1f2b]">
              {shop ? `Orders, ${shop.name}` : 'Orders'}
            </h1>
            <p className="text-xs text-[#4a3328]">
              {orders.length} order{orders.length === 1 ? '' : 's'} total
            </p>
          </div>
          <div className="text-right">
            <span className="block text-[11px] font-bold tracking-wide text-[#7a6558] uppercase">
              Total Outstanding
            </span>
            <span className="font-heading text-2xl font-black text-[#7a1f2b]">
              {inr(totalOutstanding)}
            </span>
          </div>
        </section>

        {/* Filter chips + Search box */}
        {orders.length > 0 && (
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">
              {filterTabs.map((tab) => {
                const active = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.key)}
                    className={`min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-[0.98] ${
                      active
                        ? 'bg-[#7a1f2b] text-white shadow-sm'
                        : 'border border-[#f1e3cc] bg-white text-[#4a3328] hover:border-[#e8892b]'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer…"
              aria-label="Search customer"
              className="min-h-[42px] w-full rounded-xl border border-[#f1e3cc] bg-white px-3.5 text-sm text-[#2a1a14] focus:border-[#7a1f2b] focus:outline-none sm:w-64"
            />
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="bb-card p-8 text-center text-sm text-[#7a6558]">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="bb-card p-8 text-center">
            <p className="font-heading text-lg font-extrabold text-[#7a1f2b]">No orders yet</p>
            <p className="mt-1 text-sm text-[#4a3328]">
              Speak or type your first customer order to create a shareable bill.
            </p>
            <Link
              href="/new"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#7a1f2b] px-5 py-2.5 text-sm font-bold text-white"
            >
              Record your first order
            </Link>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="bb-card p-8 text-center text-sm text-[#7a6558]">
            No matching orders found.
          </div>
        ) : (
          <>
            {/* Mobile Cards (390px) */}
            <section className="flex flex-col gap-3 md:hidden" aria-label="Orders list">
              {visibleOrders.map((order) => {
                const reminder = reminderInfo[order.id];
                const isBusy = busyId === order.id;

                return (
                  <article key={order.id} className="bb-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/b/${order.slug}`}
                          className="text-base font-extrabold text-[#7a1f2b] underline"
                        >
                          {order.customer_name}
                        </Link>
                        {order.customer_phone && (
                          <p className="text-xs text-[#7a6558]">+{order.customer_phone}</p>
                        )}
                      </div>
                      <StatusChip order={order} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#fff8ec] p-2.5 text-center text-xs">
                      <div>
                        <span className="block text-[#7a6558]">Total</span>
                        <span className="font-bold text-[#2a1a14]">{inr(order.total)}</span>
                      </div>
                      <div>
                        <span className="block text-[#7a6558]">Advance</span>
                        <span className="font-bold text-[#2a1a14]">{inr(order.advance_paid)}</span>
                      </div>
                      <div>
                        <span className="block text-[#7a6558]">Balance</span>
                        <span className="font-extrabold text-[#7a1f2b]">{inr(order.balance)}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-[#7a6558]">
                      <span>Due: {formatDueDate(order.due_date)}</span>
                      <Link
                        href={`/b/${order.slug}`}
                        className="font-semibold text-[#7a1f2b] underline"
                      >
                        View Bill
                      </Link>
                    </div>

                    {order.status === 'pending' && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-[#f1e3cc] pt-3">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            aria-label={`Payment amount for ${order.customer_name}`}
                            placeholder={String(order.balance)}
                            value={paymentInputs[order.id] ?? ''}
                            onChange={(e) =>
                              setPaymentInputs((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            className="min-h-[44px] w-28 rounded-xl border border-[#f1e3cc] bg-[#fff8ec] px-3 text-sm font-bold text-[#2a1a14]"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePayment(order)}
                            className="min-h-[44px] flex-1 rounded-xl bg-[#7a1f2b] px-3 text-xs font-bold text-white transition hover:bg-[#5b151e] disabled:opacity-50"
                          >
                            Mark payment received
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleReminder(order)}
                          className="min-h-[44px] w-full rounded-xl bg-[#e8892b] px-3 text-sm font-extrabold text-[#2a1a14] transition hover:bg-[#d97b1e] disabled:opacity-50"
                        >
                          Send reminder
                        </button>

                        {reminder && (
                          <div className="rounded-xl bg-[#fff0d6] px-3 py-2 text-xs text-[#2a1a14]">
                            <span className="font-bold">Variant used: {reminder.variant}</span> •{' '}
                            <a
                              href={reminder.wa_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-[#7a1f2b] underline"
                            >
                              Open WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            {/* Desktop Table */}
            <section className="bb-card hidden overflow-hidden md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[#f1e3cc] bg-[#fff8ec] text-xs font-bold text-[#7a6558] uppercase">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Advance</th>
                    <th className="px-3 py-3 text-right">Balance</th>
                    <th className="px-3 py-3">Due</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3e7d8]">
                  {visibleOrders.map((order) => {
                    const reminder = reminderInfo[order.id];
                    const isBusy = busyId === order.id;

                    return (
                      <tr key={order.id} className="align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/b/${order.slug}`}
                            className="font-bold text-[#7a1f2b] underline"
                          >
                            {order.customer_name}
                          </Link>
                          {order.customer_phone && (
                            <div className="text-xs text-[#7a6558]">+{order.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">{inr(order.total)}</td>
                        <td className="px-3 py-3 text-right text-[#4a3328]">
                          {inr(order.advance_paid)}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-[#7a1f2b]">
                          {inr(order.balance)}
                        </td>
                        <td className="px-3 py-3 text-xs text-[#7a6558]">
                          {formatDueDate(order.due_date)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusChip order={order} />
                        </td>
                        <td className="px-4 py-3">
                          {order.status === 'pending' ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  aria-label={`Payment amount for ${order.customer_name}`}
                                  placeholder={String(order.balance)}
                                  value={paymentInputs[order.id] ?? ''}
                                  onChange={(e) =>
                                    setPaymentInputs((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                  className="min-h-[38px] w-24 rounded-lg border border-[#f1e3cc] bg-[#fff8ec] px-2 text-xs font-bold"
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePayment(order)}
                                  className="min-h-[38px] rounded-lg bg-[#7a1f2b] px-2.5 text-xs font-bold text-white hover:bg-[#5b151e] disabled:opacity-50"
                                >
                                  Mark payment received
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleReminder(order)}
                                  className="min-h-[38px] rounded-lg bg-[#e8892b] px-2.5 text-xs font-extrabold text-[#2a1a14] hover:bg-[#d97b1e] disabled:opacity-50"
                                >
                                  Send reminder
                                </button>
                              </div>
                              {reminder && (
                                <span className="text-xs text-[#4a3328]">
                                  Variant used: <strong>{reminder.variant}</strong> •{' '}
                                  <a
                                    href={reminder.wa_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-[#7a1f2b] underline"
                                  >
                                    WhatsApp link
                                  </a>
                                </span>
                              )}
                            </div>
                          ) : (
                            <Link
                              href={`/b/${order.slug}`}
                              className="text-xs font-semibold text-[#7a6558] underline"
                            >
                              View bill
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
