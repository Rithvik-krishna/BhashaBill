import Link from 'next/link';
import { TtsListenButton } from '@/components/TtsListenButton';
import { getFlags, getOrderBySlug } from '@/lib/client/api';
import { inr } from '@/lib/money';

export const dynamic = 'force-dynamic';

function formatDate(iso: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function PublicBillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [order, flags] = await Promise.all([getOrderBySlug(slug), getFlags()]);

  if (!order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="w-full rounded-3xl border border-[#eadbc8] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-extrabold text-[#7a1f2b]">Bill not found</h1>
          <p className="mt-2 text-sm text-[#6e584f]">
            We could not find a bill with code <code className="font-mono">{slug}</code>.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#7a1f2b] px-5 py-2 text-sm font-bold text-[#fff8ec]"
          >
            Go to BhashaBill
          </Link>
        </div>
      </main>
    );
  }

  const summaryLine = `Bill from ${order.vendor.name} for ${order.customer_name}. Total ${inr(order.total)}. Balance due ${inr(order.balance)}.`;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-3 py-5 sm:px-4">
      <article className="print-clean overflow-hidden rounded-3xl border border-[#eadbc8] bg-white shadow-sm">
        {/* Top Banner */}
        <header className="border-b border-[#eadbc8] bg-[#7a1f2b] px-5 py-5 text-[#fff8ec]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-wider text-[#ffdca8] uppercase">
                {order.vendor.name}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight">
                Bill for {order.customer_name}
              </h1>
            </div>
            {flags.tts_readback && (
              <TtsListenButton summaryText={summaryLine} language={order.language} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#ffdca8]">
            <span>Date: {formatDate(order.created_at)}</span>
            <span className="font-mono">Bill #{order.slug}</span>
          </div>
        </header>

        {/* Items Table */}
        <section className="px-4 py-4 sm:px-5">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#eadbc8] text-[11px] font-bold tracking-wide text-[#6e584f] uppercase">
                <th className="py-2 pr-2">Item</th>
                <th className="px-1 py-2 text-right">Qty</th>
                <th className="px-1 py-2 text-right">Rate</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3e7d8]">
              {order.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-3 pr-2">
                    <div className="text-sm font-bold text-[#2a1a14]">{item.name_original}</div>
                    {item.name_english &&
                      item.name_english.toLowerCase() !== item.name_original.toLowerCase() && (
                        <div className="text-xs text-[#6e584f]">{item.name_english}</div>
                      )}
                  </td>
                  <td className="px-1 py-3 text-right text-sm whitespace-nowrap text-[#2a1a14]">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ''}
                  </td>
                  <td className="px-1 py-3 text-right text-sm whitespace-nowrap text-[#6e584f]">
                    {inr(item.rate)}
                  </td>
                  <td className="py-3 pl-2 text-right text-sm font-bold whitespace-nowrap text-[#2a1a14]">
                    {inr(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Large Money Summary */}
        <section className="border-t border-[#eadbc8] bg-[#fff8ec] px-5 py-5">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#6e584f]">Total</span>
              <span className="text-lg font-extrabold text-[#2a1a14]">{inr(order.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#6e584f]">Advance paid</span>
              <span className="text-base font-semibold text-[#2a1a14]">
                − {inr(order.advance_paid)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#6e584f]">Payments received</span>
              <span className="text-base font-semibold text-[#2a1a14]">
                − {inr(order.payments_total)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t-2 border-[#7a1f2b] pt-3">
            <div>
              <span className="block text-sm font-extrabold text-[#7a1f2b] uppercase">
                Balance due
              </span>
              <span className="text-xs font-semibold text-[#6e584f]">
                Due date: {formatDate(order.due_date)}
              </span>
            </div>
            <span
              className={`text-3xl font-black ${
                order.balance <= 0 ? 'text-emerald-700' : 'text-[#7a1f2b]'
              }`}
            >
              {order.balance <= 0 ? 'PAID' : inr(order.balance)}
            </span>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#eadbc8] px-5 py-4 text-center text-xs text-[#6e584f]">
          <p className="font-semibold text-[#2a1a14]">Generated by BhashaBill</p>
          <p className="mt-0.5">
            {order.vendor.name} • Ph: +{order.vendor.phone}
          </p>
        </footer>
      </article>
    </main>
  );
}
