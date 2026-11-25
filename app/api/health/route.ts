import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const time = new Date().toISOString();
  const { searchParams } = new URL(req.url);

  // Kubernetes livenessProbe: fast process-level check without hitting the database
  if (searchParams.get('probe') === 'live') {
    return Response.json({
      ok: true,
      probe: 'live',
      service: 'bhashabill',
      time,
    });
  }

  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: true,
      probe: 'ready',
      service: 'bhashabill',
      db: 'unconfigured',
      time,
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('orders').select('id').limit(1);
    if (error) {
      return Response.json(
        {
          ok: false,
          probe: 'ready',
          service: 'bhashabill',
          db: 'error',
          message: error.message,
          time,
        },
        { status: 503 },
      );
    }

    return Response.json({
      ok: true,
      probe: 'ready',
      service: 'bhashabill',
      db: 'ok',
      time,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        probe: 'ready',
        service: 'bhashabill',
        db: 'error',
        message: err instanceof Error ? err.message : 'Database ping failed',
        time,
      },
      { status: 503 },
    );
  }
}
