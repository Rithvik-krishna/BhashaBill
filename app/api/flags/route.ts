import { getPublicFlags } from '@/lib/server/flagsmith';

export const dynamic = 'force-dynamic';

export async function GET() {
  const flags = await getPublicFlags();
  return Response.json(flags, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
