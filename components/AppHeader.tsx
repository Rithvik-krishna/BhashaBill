'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VENDOR } from '@/lib/vendor';

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-[#eadbc8] bg-[#7a1f2b] text-[#fff8ec] shadow-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-tight text-[#fff8ec]">
            BhashaBill
          </span>
          <span className="text-xs text-[#ffdca8]">{VENDOR.name}</span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Primary">
          <Link
            href="/"
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              pathname === '/'
                ? 'bg-[#e8892b] text-[#2a1a14]'
                : 'bg-[#5b151e] text-[#fff8ec] hover:bg-[#6a1924]'
            }`}
          >
            New Order
          </Link>
          <Link
            href="/orders"
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              pathname.startsWith('/orders')
                ? 'bg-[#e8892b] text-[#2a1a14]'
                : 'bg-[#5b151e] text-[#fff8ec] hover:bg-[#6a1924]'
            }`}
          >
            Orders
          </Link>
        </nav>
      </div>
    </header>
  );
}
