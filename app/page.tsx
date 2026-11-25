import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';

const STEPS = [
  {
    num: '1',
    title: 'Speak or type the order',
    desc: 'Record in Kannada, Hindi, Tamil, or English — or type a quick note.',
  },
  {
    num: '2',
    title: 'Review the itemised bill',
    desc: 'Sarvam AI extracts items, quantities, and advance. Totals are always verified in code.',
  },
  {
    num: '3',
    title: 'Share link & track balance',
    desc: 'Customers get a public bilingual bill link while you track pending dues and reminders.',
  },
];

const SPONSORS = [
  { name: 'Sarvam AI', role: 'Voice STT, Extraction & TTS' },
  { name: 'Flagsmith', role: 'Remote Config & A/B Tone' },
  { name: 'NudgeBee', role: 'Service Monitoring' },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--body)]">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
        <section className="bb-card p-6 text-center sm:p-8">
          <span className="inline-block rounded-full border border-[var(--border)] bg-[#fff2dc] px-3 py-1 text-xs font-semibold text-[var(--maroon)]">
            Festive Hacks 2026 &bull; Bengaluru
          </span>

          <h1 className="font-heading mt-4 text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
            Speak the order.
            <span className="block text-[var(--maroon)]">Share the bill.</span>
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Turn voice orders in Kannada, Hindi, Tamil, or English into clean, bilingual customer bills in seconds.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/new"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--saffron)] px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[var(--saffron-dark)]"
            >
              Start New Order
            </Link>
            <Link
              href="/orders"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-white px-6 py-3 text-base font-semibold text-[var(--maroon)] transition hover:bg-[#fff8ec]"
            >
              View Orders
            </Link>
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="flex flex-col gap-3">
          <h2 id="how-it-works" className="font-heading px-1 text-lg font-bold text-[var(--ink)]">
            How it works
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="bb-card flex flex-col gap-2 p-4">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--maroon)] text-xs font-bold text-[#fff8ec]">
                  {step.num}
                </span>
                <h3 className="font-heading text-base font-bold text-[var(--ink)]">{step.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--muted)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bb-card p-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Powered by
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SPONSORS.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-[var(--border)] bg-[var(--cream)] px-3 py-2 text-center"
              >
                <div className="text-sm font-bold text-[var(--maroon)]">{s.name}</div>
                <div className="text-[11px] text-[var(--muted)]">{s.role}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
