'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveDemoShop } from '@/lib/client/shop';

/** Hero CTA buttons: loads DEMO_SHOP and navigates to the app, or routes to shop setup. */
export function WelcomeHeroActions() {
  const router = useRouter();

  const handleTryDemo = () => {
    saveDemoShop();
    router.push('/');
  };

  return (
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={handleTryDemo}
        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#7a1f2b] px-6 py-3 text-base font-bold text-[#fff8ec] shadow-sm transition hover:bg-[#5b151e] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
      >
        Try the demo shop
      </button>
      <Link
        href="/"
        className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#e3cfa8] bg-white px-6 py-3 text-base font-bold text-[#7a1f2b] transition hover:bg-[#fff2dc] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f2b]"
      >
        Set up my shop
      </Link>
    </div>
  );
}
