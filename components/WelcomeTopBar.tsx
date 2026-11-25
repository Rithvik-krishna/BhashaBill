import Link from 'next/link';

function WelcomeLogoMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M6 7C6 4.79086 7.79086 3 10 3H26C28.2091 3 30 4.79086 30 7V21C30 23.2091 28.2091 25 26 25H14L8 31V25H10C7.79086 25 6 23.2091 6 21V7Z"
        fill="#e8892b"
      />
      <path
        d="M14 9.5H22M14 13H22M14.5 9.5C16.7 9.5 18.2 10.7 18.2 12.6C18.2 14.5 16.7 15.8 14.3 15.8H14L19.8 20.8"
        stroke="#7a1f2b"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Slim landing-page top bar with logomark and "Open app" link; omits shop pill and app nav. */
export function WelcomeTopBar() {
  return (
    <header className="bb-header-pattern sticky top-0 z-20 border-b border-[#5b151e] text-[#fff8ec] shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href="/welcome"
          className="flex min-h-[44px] items-center gap-2.5 rounded-xl pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8]"
        >
          <WelcomeLogoMark />
          <span className="font-heading text-xl font-extrabold tracking-tight text-[#fff8ec]">
            BhashaBill
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#e8892b] px-4 py-2 text-sm font-bold text-[#2a1a14] shadow-sm transition hover:bg-[#f09a43] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8]"
        >
          Open app
        </Link>
      </div>
    </header>
  );
}
