import { round2 } from '@/lib/money';
import {
  buildOrderSummary,
  isUuid,
  paymentSchema,
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = paymentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message || 'Invalid payment amount.' },
      { status: 400 },
    );
  }

  const amount = round2(parsed.data.amount);

  try {
    const supabase = getSupabaseAdmin();
    const lookupColumn = isUuid(id) ? 'id' : 'slug';

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(amount)')
      .eq(lookupColumn, id)
      .maybeSingle();

    if (error) {
      console.error('[api/orders/[id]/payments POST] fetch error:', error);
      return Response.json({ message: 'Failed to load order.' }, { status: 500 });
    }

    if (!data) {
      return Response.json({ message: 'Order not found.' }, { status: 404 });
    }

    const order = data as OrderWithRelations;

    const { error: insertError } = await supabase.from('payments').insert({
      order_id: order.id,
      amount,
    });

    if (insertError) {
      console.error('[api/orders/[id]/payments POST] insert error:', insertError);
      return Response.json({ message: 'Failed to record payment.' }, { status: 500 });
    }

    const updatedPayments: PaymentRow[] = [...(order.payments ?? []), { amount }];
    const summary = buildOrderSummary(order, order.order_items ?? null, updatedPayments);

    if (summary.status !== order.status) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: summary.status })
        .eq('id', order.id);

      if (updateError) {
        console.error('[api/orders/[id]/payments POST] status update error:', updateError);
      }
    }

    return Response.json(summary);
  } catch (err) {
    console.error('[api/orders/[id]/payments POST] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'Failed to record payment.' },
      { status: 500 },
    );
  }
}
