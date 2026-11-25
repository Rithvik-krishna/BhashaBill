import {
  buildOrderDetail,
  isUuid,
  type OrderItemRow,
  type OrderRow,
  type PaymentRow,
} from '@/lib/server/orders';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

type OrderWithRelations = OrderRow & {
  order_items?: OrderItemRow[] | null;
  payments?: PaymentRow[] | null;
};

// Note: Named [id] to share the dynamic segment with /api/orders/[id]/payments and /reminder.
// GET /api/orders/[slug] looks up by slug first, falling back to UUID id if provided.
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: slugOrId } = await context.params;
  if (!slugOrId || !slugOrId.trim()) {
    return Response.json({ message: 'Missing order slug.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    let { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(amount)')
      .eq('slug', slugOrId)
      .maybeSingle();

    if (!error && !data && isUuid(slugOrId)) {
      const byId = await supabase
        .from('orders')
        .select('*, order_items(*), payments(amount)')
        .eq('id', slugOrId)
        .maybeSingle();
      data = byId.data;
      error = byId.error;
    }

    if (error) {
      console.error('[api/orders/[id] GET] supabase error:', error);
      return Response.json({ message: 'Failed to load bill.' }, { status: 500 });
    }

    if (!data) {
      return Response.json({ message: 'Order not found.' }, { status: 404 });
    }

    const row = data as OrderWithRelations;
    const detail = buildOrderDetail(row, row.order_items ?? [], row.payments ?? []);
    return Response.json(detail, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[api/orders/[id] GET] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'Failed to load bill.' },
      { status: 500 },
    );
  }
}
