import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintBillButton } from '@/components/PrintBillButton';
import { TtsListenButton } from '@/components/TtsListenButton';
import { getFlags, getOrderBySlug } from '@/lib/client/api';
import { amountInWords } from '@/lib/client/words';
import { inr } from '@/lib/money';

export const dynamic = 'force-dynamic';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatBillNumber(slug: string): string {
  return `BB-${slug.slice(-6).toUpperCase()}`;
}

function formatIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const order = await getOrderBySlug(slug);

  if (!order) {
    return {
      title: 'Bill not found | BhashaBill',
      robots: { index: false, follow: false },
    };
  }

  const shopLabel = order.vendor.city
    ? `${order.vendor.name}, ${order.vendor.city}`
    : order.vendor.name;
  const title =
    order.balance <= 0
      ? `Bill from ${shopLabel}: paid`
      : `Bill from ${shopLabel}: ${inr(order.balance)} due`;
  const description = `${order.customer_name}'s order, ${order.items.length} item${
    order.items.length === 1 ? '' : 's'
  }. Total ${inr(order.total)}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PublicBillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [order, flags] = await Promise.all([getOrderBySlug(slug), getFlags()]);

  if (!order) {
    notFound();
  }

  const billNumber = formatBillNumber(order.slug);
  const shopDisplay = order.vendor.city
    ? `${order.vendor.name}, ${order.vendor.city}`
    : order.vendor.name;
  const summaryLine = `Bill from ${shopDisplay} for ${order.customer_name}. Total ${inr(
    order.total,
  )}. Balance due ${inr(order.balance)}.`;

  const vendorDigits = order.vendor.phone.replace(/\D/g, '');
  const waText = `Hi, about bill ${billNumber}`;
  const vendorWaUrl = `https://wa.me/${vendorDigits}?text=${encodeURIComponent(waText)}`;
  const formattedPhone = formatIndianPhone(order.vendor.phone);

  const statusChip =
    order.status === 'paid' ? (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
        Paid
      </span>
    ) : order.overdue ? (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-800">
        Overdue
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
        Pending
      </span>
    );

  return (
    <main className="mx-auto min-h-screen max-w-lg px-3 py-5 sm:px-4">
      {/* Top small BhashaBill logomark + Save as PDF */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <svg
            width="26"
            height="26"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M6 7C6 4.79086 7.79086 3 10 3H26C28.2091 3 30 4.79086 30 7V21C30 23.2091 28.2091 25 26 25H14L8 31V25H10C7.79086 25 6 23.2091 6 21V7Z"
              fill="#7a1f2b"
            />
            <path
              d="M14 9.5H22M14 13H22M14.5 9.5C16.7 9.5 18.2 10.7 18.2 12.6C18.2 14.5 16.7 15.8 14.3 15.8H14L19.8 20.8"
              stroke="#e8892b"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-heading text-sm font-extrabold text-[#7a1f2b]">BhashaBill</span>
        </div>
        <PrintBillButton />
      </div>

      <article className="print-clean bb-card overflow-hidden">
        {/* Top Banner */}
        <header className="bb-header-pattern border-b border-[#f1e3cc] px-5 py-5 text-[#fff8ec]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-wider text-[#ffdca8] uppercase">
                {shopDisplay}
              </p>
              <h1 className="font-heading mt-1 text-2xl leading-tight font-extrabold">
                Bill for {order.customer_name}
              </h1>
            </div>
            {flags.tts_readback && (
              <TtsListenButton summaryText={summaryLine} language={order.language} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#ffdca8]">
            <span>Date: {formatDate(order.created_at)}</span>
            <span className="font-mono font-bold">{billNumber}</span>
          </div>
        </header>

        {/* Items Table */}
        <section className="px-4 py-4 sm:px-5">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f1e3cc] text-[11px] font-bold tracking-wide text-[#7a6558] uppercase">
                <th className="py-2 pr-2">Item</th>
                <th className="px-1 py-2 text-right">Qty</th>
                <th className="px-1 py-2 text-right">Rate</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3e7d8]">
              {order.items.map((item) => {
                const showEnglish =
                  Boolean(item.name_english) &&
                  item.name_english.trim().toLowerCase() !==
                    item.name_original.trim().toLowerCase();
                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-3 pr-2">
                      <div className="text-sm font-bold text-[#2a1a14]">{item.name_original}</div>
                      {showEnglish && (
                        <div className="text-xs text-[#7a6558]">{item.name_english}</div>
                      )}
                    </td>
                    <td className="px-1 py-3 text-right text-sm whitespace-nowrap text-[#2a1a14]">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ''}
                    </td>
                    <td className="px-1 py-3 text-right text-sm whitespace-nowrap text-[#4a3328]">
                      {inr(item.rate)}
                    </td>
                    <td className="py-3 pl-2 text-right text-sm font-bold whitespace-nowrap text-[#2a1a14]">
                      {inr(item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Large Money Summary */}
        <section className="border-t border-[#f1e3cc] bg-[#fff8ec] px-5 py-5">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-semibold text-[#4a3328]">Total</span>
                <p className="text-xs text-[#7a6558]">{amountInWords(order.total)}</p>
              </div>
              <span className="text-lg font-extrabold text-[#2a1a14]">{inr(order.total)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-[#4a3328]">Advance paid</span>
              <span className="text-base font-semibold text-[#2a1a14]">
                − {inr(order.advance_paid)}
              </span>
            </div>

            {order.payments_total > 0 && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#4a3328]">Payments received</span>
                <span className="text-base font-semibold text-[#2a1a14]">
                  − {inr(order.payments_total)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#7a1f2b] pt-3">
            <div>
              <span className="block text-sm font-extrabold text-[#7a1f2b] uppercase">
                Balance due
              </span>
              {order.due_date && (
                <span className="text-xs font-semibold text-[#4a3328]">
                  Due date: {formatDate(order.due_date)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {statusChip}
              <span
                className={`font-heading text-3xl font-black ${
                  order.balance <= 0 ? 'text-emerald-700' : 'text-[#7a1f2b]'
                }`}
              >
                {order.balance <= 0 ? '₹0' : inr(order.balance)}
              </span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#f1e3cc] px-5 py-4 text-center text-xs text-[#4a3328]">
          <p className="font-semibold text-[#2a1a14]">{shopDisplay}</p>
          <p className="mt-1">
            <a
              href={`tel:+${vendorDigits}`}
              className="font-bold text-[#7a1f2b] underline underline-offset-2"
            >
              {formattedPhone}
            </a>
          </p>
          <div className="no-print mt-3 flex justify-center">
            <a
              href={vendorWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#25D366] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#1fb858]"
            >
              Questions? WhatsApp {order.vendor.name}
            </a>
          </div>
          <p className="mt-3 text-[11px] text-[#7a6558]">Generated by BhashaBill</p>
        </footer>
      </article>
    </main>
  );
}
