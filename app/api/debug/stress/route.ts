export const dynamic = 'force-dynamic';

// Demo-only simulated incident endpoint for NudgeBee monitoring.
// Disabled unless ENABLE_STRESS_ENDPOINT=true.
// Supports:
//   - mode=error -> returns HTTP 500 to simulate an error-rate incident
//   - mode=stress (default) -> bounded CPU burn (ms) + temporary memory pressure (mb)

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

async function runStress(ms: number, mb: number) {
  const started = Date.now();

  // Allocate temporary memory buffer (bounded to 256 MB) and touch pages so RSS rises visibly
  let buffer: Buffer | null = null;
  if (mb > 0) {
    buffer = Buffer.alloc(mb * 1024 * 1024);
    for (let i = 0; i < buffer.length; i += 4096) {
      buffer[i] = i & 0xff;
    }
  }

  // Bounded CPU burn to simulate an event-loop / CPU latency spike
  if (ms > 0) {
    const end = Date.now() + ms;
    let checksum = 0;
    while (Date.now() < end) {
      checksum = (checksum + Math.sqrt(Date.now())) % 1_000_000;
    }
    if (checksum < 0) console.log(checksum);
  }

  const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  buffer = null;

  return {
    ok: true,
    simulated: true,
    mode: 'stress',
    requested_ms: ms,
    requested_mb: mb,
    elapsed_ms: Date.now() - started,
    rss_mb: rssMb,
    time: new Date().toISOString(),
  };
}

function simulatedErrorResponse() {
  console.error('[api/debug/stress] simulated HTTP 500 error triggered for NudgeBee demo');
  return Response.json(
    {
      ok: false,
      simulated: true,
      mode: 'error',
      message: 'Simulated internal server error for NudgeBee incident demo.',
      time: new Date().toISOString(),
    },
    { status: 500 },
  );
}

export async function GET(req: Request) {
  if (process.env.ENABLE_STRESS_ENDPOINT !== 'true') {
    return Response.json({ message: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') ?? 'stress').toLowerCase();
  if (mode === 'error') {
    return simulatedErrorResponse();
  }

  const ms = clamp(Number(searchParams.get('ms') ?? 2500), 0, 15000);
  const mb = clamp(Number(searchParams.get('mb') ?? 64), 0, 256);

  const result = await runStress(ms, mb);
  return Response.json(result);
}

export async function POST(req: Request) {
  if (process.env.ENABLE_STRESS_ENDPOINT !== 'true') {
    return Response.json({ message: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  let mode = (searchParams.get('mode') ?? 'stress').toLowerCase();
  let ms = 2500;
  let mb = 64;

  try {
    const body = (await req.json()) as { mode?: string; ms?: number; mb?: number };
    if (body.mode) mode = body.mode.toLowerCase();
    if (body.ms !== undefined) ms = clamp(Number(body.ms), 0, 15000);
    if (body.mb !== undefined) mb = clamp(Number(body.mb), 0, 256);
  } catch {
    // Use defaults if body is empty
  }

  if (mode === 'error') {
    return simulatedErrorResponse();
  }

  const result = await runStress(ms, mb);
  return Response.json(result);
}
