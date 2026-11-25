// Backend owner extends this (e.g. DB ping). NudgeBee-monitored infra checks it.
export async function GET() {
  return Response.json({ ok: true, service: 'bhashabill', time: new Date().toISOString() });
}
