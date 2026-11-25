import Link from 'next/link';

export default function BillNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="bb-card w-full p-6">
        <h1 className="font-heading text-2xl font-extrabold text-[#7a1f2b]">Bill not found</h1>
        <p className="mt-2 text-sm text-[#4a3328]">
          This bill link may be incorrect or no longer available. Please ask the shopkeeper for a
          fresh link.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#7a1f2b] px-5 py-2.5 text-sm font-bold text-white"
        >
          Go to BhashaBill
        </Link>
      </div>
    </main>
  );
}
