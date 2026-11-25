import type { ReminderResponse } from '@/lib/contract';
import { getReminderConfig, renderReminderMessage } from '@/lib/server/flagsmith';
import {
  buildOrderSummary,
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

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const supabase = getSupabaseAdmin();
    const lookupColumn = isUuid(id) ? 'id' : 'slug';

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(amount)')
      .eq(lookupColumn, id)
      .maybeSingle();

    if (error) {
      console.error('[api/orders/[id]/reminder POST] fetch error:', error);
      return Response.json({ message: 'Failed to load order.' }, { status: 500 });
    }

    if (!data) {
      return Response.json({ message: 'Order not found.' }, { status: 404 });
    }

    const order = data as OrderWithRelations;
    const summary = buildOrderSummary(order, order.order_items ?? null, order.payments ?? []);

    // Flagsmith A/B identity = customer phone or order slug, with order traits
    const identity = order.customer_phone?.replace(/\D/g, '') || order.slug;
    const { variant, template } = await getReminderConfig(identity, {
      is_overdue: summary.overdue,
      language: order.language,
      balance: summary.balance,
    });

    const message = renderReminderMessage(template, {
      name: summary.customer_name,
      balance: summary.balance,
      date: summary.due_date,
    });

    // Log variant + message in reminders table for A/B experiment auditability
    const { error: logError } = await supabase.from('reminders').insert({
      order_id: order.id,
      variant,
      message,
    });

    if (logError) {
      console.error('[api/orders/[id]/reminder POST] log insert error:', logError);
    }

    const digits = (order.customer_phone ?? '').replace(/\D/g, '');
    const wa_url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    const response: ReminderResponse = {
      variant,
      message,
      wa_url,
    };

    return Response.json(response);
  } catch (err) {
    console.error('[api/orders/[id]/reminder POST] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'Failed to generate reminder.' },
      { status: 500 },
    );
  }
}
