/** Static, pure-markup sample bill card with spoken Kannada order bubble above it. */
export function SampleBillCard() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
      {/* Speech bubble */}
      <div className="relative mb-5 rounded-2xl border border-[#f1e3cc] bg-white px-4 py-3 shadow-[0_6px_20px_rgba(122,31,43,0.07)]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7a1f2b]">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#e8892b]"
          />
          Spoken order
        </div>
        <p className="mt-1 text-sm font-medium leading-relaxed text-[#2a1a14]">
          “ರಮೇಶ್ ಅವರಿಗೆ 2 ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್, 1 ಕೆಜಿ ಲಡ್ಡು, 500 ರೂಪಾಯಿ ಅಡ್ವಾನ್ಸ್, ಶುಕ್ರವಾರ ಬೇಕು”
        </p>
        <div
          aria-hidden="true"
          className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-r border-b border-[#f1e3cc] bg-white"
        />
      </div>

      {/* Tilted sample bill card */}
      <div className="bb-card rotate-[1.5deg] p-5 shadow-[0_18px_40px_rgba(122,31,43,0.12)] sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-[#f1e3cc] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7a6558]">
              Lakshmi Sweets, Mysuru
            </p>
            <h2 className="font-heading mt-0.5 text-xl font-extrabold text-[#2a1a14]">
              Bill for Ramesh
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-[#f5c26b] bg-[#fff3d6] px-2.5 py-1 text-xs font-bold text-[#7a4b00]">
            Pending
          </span>
        </div>

        <div className="divide-y divide-[#f6ebd8] py-2">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-[#2a1a14]">ಮೈಸೂರು ಪಾಕ್</p>
              <p className="text-xs font-medium text-[#7a6558]">Mysore Pak</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-[#2a1a14]">₹1,200</p>
              <p className="text-xs text-[#7a6558]">2 kg × ₹600</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-[#2a1a14]">ಲಡ್ಡು</p>
              <p className="text-xs font-medium text-[#7a6558]">Laddu</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-[#2a1a14]">₹700</p>
              <p className="text-xs text-[#7a6558]">1 kg × ₹700</p>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1.5 border-t border-[#f1e3cc] pt-3.5 text-sm">
          <div className="flex items-center justify-between text-[#5a4438]">
            <span>Total</span>
            <span className="font-semibold text-[#2a1a14]">₹1,900</span>
          </div>
          <div className="flex items-center justify-between text-[#5a4438]">
            <span>Advance</span>
            <span className="font-semibold text-[#2a1a14]">-₹500</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-[#ead7b7] pt-2.5">
            <span className="text-sm font-bold text-[#7a1f2b]">Balance due</span>
            <span className="font-heading text-2xl font-extrabold text-[#7a1f2b]">₹1,400</span>
          </div>
          <p className="pt-1 text-right text-xs font-semibold text-[#7a6558]">Due Fri 27 Nov</p>
        </div>
      </div>
    </div>
  );
}
