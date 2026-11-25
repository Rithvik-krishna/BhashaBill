import type { Metadata } from 'next';
import { SampleBillCard } from '@/components/SampleBillCard';
import { WelcomeHeroActions } from '@/components/WelcomeHeroActions';
import { WelcomeTopBar } from '@/components/WelcomeTopBar';

export const metadata: Metadata = {
  title: 'BhashaBill — Speak the order. Share the bill.',
  description:
    'Turn voice orders in Kannada, Hindi, Tamil or English into clean, bilingual bills in seconds.',
};

const LANGUAGES = ['ಕನ್ನಡ', 'हिन्दी', 'தமிழ்', 'English'] as const;

const STEPS = [
  {
    num: '1',
    title: 'Speak or type',
    desc: 'Record the order in Kannada, Hindi, Tamil or English, or type a quick note if the counter is noisy.',
  },
  {
    num: '2',
    title: 'Review the bill',
    desc: 'Edit items, rates, advance and due date before saving. Every line amount and balance is computed in code.',
  },
  {
    num: '3',
    title: 'Share & track',
    desc: 'Send a public bilingual bill link to your customer and track pending balances or WhatsApp reminders.',
  },
] as const;

const SPONSORS = [
  { name: 'Sarvam AI', detail: 'voice to bill' },
  { name: 'Flagsmith', detail: 'reminder A/B tests' },
  { name: 'NudgeBee', detail: 'service monitoring' },
] as const;

export default function WelcomeLandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--cream)] text-[#4a3328]">
      <WelcomeTopBar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 sm:gap-16 sm:px-6 sm:py-16">
        {/* Hero: two columns >=1024px, stacked on mobile */}
        <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="bb-fade-up">
            <span className="inline-block rounded-full border border-[#f1e3cc] bg-[#fff2dc] px-3.5 py-1.5 text-xs font-bold text-[#7a1f2b]">
              Festive Hacks 2026 &bull; Bengaluru
            </span>

            <h1 className="font-heading mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-[#2a1a14] sm:text-5xl">
              Speak the order.
              <span className="block text-[#7a1f2b]">Share the bill.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#4a3328] sm:text-lg">
              Turn voice orders in Kannada, Hindi, Tamil or English into clean, bilingual bills in
              seconds.
            </p>

            <div
              aria-label="Supported languages"
              className="mt-5 flex flex-wrap items-center gap-2"
            >
              {LANGUAGES.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full border border-[#ead7b7] bg-white px-3 py-1 text-sm font-semibold text-[#5a4438]"
                >
                  {lang}
                </span>
              ))}
            </div>

            <WelcomeHeroActions />
          </div>

          <div className="bb-fade-up bb-delay-1">
            <SampleBillCard />
          </div>
        </section>

        {/* Problem strip */}
        <section
          aria-label="The problem"
          className="bb-fade-up bb-delay-2 border-y border-[#f1e3cc] py-6 sm:py-8"
        >
          <p className="mx-auto max-w-3xl text-center text-base font-medium leading-relaxed text-[#4a3328] sm:text-lg">
            <span className="font-heading font-bold text-[#7a1f2b]">“I never ordered that.”</span>{' '}
            Every festival, small shops lose time and money arguing about orders taken by voice.
          </p>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-it-works" className="bb-fade-up bb-delay-2">
          <h2
            id="how-it-works"
            className="font-heading text-2xl font-extrabold tracking-tight text-[#2a1a14] sm:text-3xl"
          >
            How it works
          </h2>

          <div className="mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.num} className="bb-card flex h-full flex-col gap-3 p-6">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7a1f2b] text-sm font-extrabold text-[#fff8ec]">
                  {step.num}
                </span>
                <h3 className="font-heading text-xl font-bold text-[#2a1a14]">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-[#5a4438]">{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Sponsors */}
        <section aria-label="Built with" className="bb-fade-up bb-delay-3">
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#f1e3cc] bg-white/80 px-5 py-4 sm:flex-row">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7a6558]">
              Built with
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {SPONSORS.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ead7b7] bg-[#fff8ec] px-3.5 py-1.5 text-sm text-[#4a3328]"
                >
                  <strong className="font-bold text-[#7a1f2b]">{s.name}:</strong>
                  <span>{s.detail}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#f1e3cc] bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-[#5a4438] sm:flex-row sm:px-6 sm:text-left">
          <div>
            <p className="font-semibold text-[#2a1a14]">Built at Festive Hacks 2026, Bengaluru</p>
            <p className="mt-0.5 text-sm text-[#7a6558]">
              No login. Your shop profile stays on your device.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#"
              className="inline-flex min-h-[44px] items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-[#7a1f2b] underline-offset-4 transition hover:bg-[#fff2dc] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
            >
              GitHub
            </a>
            <a
              href="#"
              className="inline-flex min-h-[44px] items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-[#7a1f2b] underline-offset-4 transition hover:bg-[#fff2dc] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
            >
              Demo video
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
