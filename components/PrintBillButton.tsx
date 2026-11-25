'use client';

export function PrintBillButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#f1e3cc] bg-white px-4 py-2 text-sm font-bold text-[#7a1f2b] transition hover:border-[#e8892b] active:scale-[0.98]"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"
        />
      </svg>
      <span>Save as PDF</span>
    </button>
  );
}
