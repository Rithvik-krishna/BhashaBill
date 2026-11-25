# BhashaBill: shared context for every AI agent working in this repo

PROJECT: BhashaBill, a mobile-first web app for the "Festive Hacks" hackathon (Bengaluru, Nov 25 2026,
submission deadline 5:00 PM IST). A festive vendor speaks an order in Kannada/Hindi/Tamil/English; the app
turns it into an itemised bill that the vendor reviews and edits; the customer gets a public bilingual bill
link; the vendor tracks balance due and sends reminders. One hardcoded demo vendor (see lib/vendor.ts).
No login, no payments/UPI, no GST, no inventory, no multi-vendor, no native app.

STACK: Next.js (App Router, TypeScript), Tailwind v4, Supabase (Postgres, accessed only from API routes with
the service role key), Docker. All three sponsors MUST be genuinely used: Sarvam AI (speech-to-text, chat
extraction, optional text-to-speech), Flagsmith (remote config + A/B variant + feature flag), NudgeBee
(monitoring of the deployed service, with one simulated incident).

SCREENS (exactly four): New Order (/), Review Bill (/review), Public Bill (/b/[slug]), Dashboard (/orders).

## Ownership (never edit the other person's files)
| Owner | Directories |
|---|---|
| Frontend (Rithvik) | app/page.tsx, app/review/**, app/b/**, app/orders/**, components/**, lib/client/**, lib/mock.ts, app/globals.css |
| Backend (Chris) | app/api/**, lib/server/**, supabase/**, scripts/**, Dockerfile, docker-compose.yml, k8s/**, .env.example |
| Shared, frozen | lib/contract.ts, lib/money.ts, lib/vendor.ts (change only after telling the other person) |

## Rules
1. Read lib/contract.ts, lib/money.ts and lib/vendor.ts first. They are the source of truth.
2. Money is computed in code with lib/money.ts. Never trust the LLM's arithmetic. The server recomputes
   every amount, total and balance; client-sent totals are ignored.
3. The review screen is always shown before anything is saved.
4. No new features beyond the task. No auth, no extra pages. No new dependencies unless truly needed.
5. Plan first (short), then implement. Commit small and often; run `npm run build` before each push;
   `git pull --rebase` before pushing.
6. Secrets only through env vars. Never commit keys. Keep .env.example current.
7. Mobile-first: test at 390px width.
8. If something takes more than 30 minutes of debugging, stop and tell the team; use the simpler fallback
   (for example the text box instead of voice).
9. Feature freeze at 3:30 PM. After that, bug fixes only.

## Pipeline
Audio (MediaRecorder) -> POST /api/transcribe -> Sarvam STT -> Sarvam chat extraction (JSON only) ->
server validation (zod, recompute money) -> Review screen -> POST /api/orders -> public /b/[slug] page.

## Flagsmith flags (created in the Flagsmith dashboard)
- reminder_templates: remote config JSON {"polite": "...", "firm": "..."} with {name}, {balance}, {date}
- reminder_tone_test: multivariate flag, identity = customer phone or order slug, value polite|firm
- tts_readback: boolean feature flag for the spoken bill summary
