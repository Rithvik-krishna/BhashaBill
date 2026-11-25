'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShopSetup } from '@/components/ShopSetup';
import { useShop } from '@/lib/client/shop';

function LogoMark() {
  return (
    <svg
      width="36"
      height="36"
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AppHeader() {
  const pathname = usePathname();
  const { shop, ready } = useShop();
  const [editOpen, setEditOpen] = useState(false);

  const isHome = pathname === '/';
  const isOrders = pathname.startsWith('/orders');

  return (
    <>
      <header className="no-print bb-header-pattern sticky top-0 z-20 border-b border-[#5b151e] text-[#fff8ec] shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="flex min-h-[44px] items-center gap-2 rounded-xl pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8]"
            >
              <LogoMark />
              <span className="font-heading text-xl font-extrabold tracking-tight text-[#fff8ec]">
                BhashaBill
              </span>
            </Link>

            {ready && shop && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label={`Edit shop profile: ${shop.name}`}
                className="flex min-h-[40px] min-w-0 items-center gap-2 rounded-full bg-[#5b151e] px-2.5 py-1 text-left transition hover:bg-[#6a1924] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8892b] text-xs font-extrabold text-[#2a1a14]">
                  {getInitials(shop.name)}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-[#ffdca8]">
                  {shop.name}
                  {shop.city ? ` · ${shop.city}` : ''}
                </span>
              </button>
            )}
          </div>

          {/* Desktop / Tablet header nav */}
          <nav className="hidden shrink-0 items-center gap-2 sm:flex" aria-label="Primary">
            <Link
              href="/"
              className={`flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8] ${
                isHome
                  ? 'bg-[#e8892b] text-[#2a1a14] shadow-sm'
                  : 'bg-[#5b151e] text-[#fff8ec] hover:bg-[#6a1924]'
              }`}
            >
              New Order
            </Link>
            <Link
              href="/orders"
              className={`flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdca8] ${
                isOrders
                  ? 'bg-[#e8892b] text-[#2a1a14] shadow-sm'
                  : 'bg-[#5b151e] text-[#fff8ec] hover:bg-[#6a1924]'
              }`}
            >
              Orders
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile fixed bottom tab bar (<640px) */}
      <nav
        aria-label="Mobile navigation"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[#f1e3cc] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2 px-4 py-1.5">
          <Link
            href="/"
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] ${
              isHome ? 'bg-[#fff0d6] text-[#7a1f2b]' : 'text-[#7a6558] hover:text-[#4a3328]'
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
              />
            </svg>
            <span>New Order</span>
          </Link>

          <Link
            href="/orders"
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b] ${
              isOrders ? 'bg-[#fff0d6] text-[#7a1f2b]' : 'text-[#7a6558] hover:text-[#4a3328]'
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4"
              />
            </svg>
            <span>Orders</span>
          </Link>
        </div>
      </nav>

      {/* First-visit onboarding sheet (shown on /, /review, /orders; never on /b/**) */}
      <ShopSetup open={ready && !shop} mode="onboarding" />

      {/* Edit shop sheet */}
      <ShopSetup
        open={editOpen}
        mode="edit"
        initialShop={shop}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
