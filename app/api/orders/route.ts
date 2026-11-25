import type { OrderSummary, SaveOrderResponse } from '@/lib/contract';
import { lineAmount, round2, totals } from '@/lib/money';
import {
  buildOrderSummary,
  makeSlug,
  saveOrderSchema,
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vendorKey = (searchParams.get('vendor_key') ?? '').trim();
  if (!vendorKey) {
    return Response.json({ message: 'vendor_key is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(amount)')
      .eq('vendor_key', vendorKey)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/orders GET] supabase error:', error);
      return Response.json({ message: 'Failed to load orders.' }, { status: 500 });
    }

    const summaries: OrderSummary[] = ((data ?? []) as OrderWithRelations[]).map((row) =>
      buildOrderSummary(row, row.order_items ?? null, row.payments ?? []),
    );

    return Response.json(summaries, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[api/orders GET] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'Failed to load orders.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = saveOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message || 'Invalid order payload.' },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const advancePaid = round2(input.advance_paid);

  // Always recompute every line amount, total, and balance server-side via lib/money.ts
  const computedItems = input.items.map((item, idx) => {
    const rate = round2(item.rate);
    const amount = lineAmount(item.quantity, rate);
    return {
      name_original: item.name_original,
      name_english: item.name_english,
      quantity: item.quantity,
      unit: item.unit,
      rate,
      amount,
      sort_order: idx,
    };
  });

  const { total, balance } = totals(computedItems, advancePaid, 0);
  const status: 'pending' | 'paid' = balance <= 0 ? 'paid' : 'pending';

  try {
    const supabase = getSupabaseAdmin();

    // Insert order with retries in case of rare slug collision
    let insertedOrder: { id: string; slug: string } | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = makeSlug(input.customer_name);
      const { data, error } = await supabase
        .from('orders')
        .insert({
          slug,
          vendor_key: input.vendor_key,
          vendor_name: input.vendor.name,
          vendor_phone: input.vendor.phone,
          vendor_city: input.vendor.city,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          language: input.language,
          transcript: input.transcript,
          total,
          advance_paid: advancePaid,
          due_date: input.due_date,
          due_date_text: input.due_date_text,
          status,
        })
        .select('id, slug')
        .single();

      if (!error && data) {
        insertedOrder = data as { id: string; slug: string };
        break;
      }

      lastError = error?.message ?? 'Failed to insert order';
      if (error?.code !== '23505') break;
    }

    if (!insertedOrder) {
      console.error('[api/orders POST] insert order error:', lastError);
      return Response.json({ message: lastError || 'Failed to save order.' }, { status: 500 });
    }

    const itemsToInsert = computedItems.map((item) => ({
      ...item,
      order_id: insertedOrder.id,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) {
      console.error('[api/orders POST] insert items error:', itemsError);
      // Roll back orphan order row
      await supabase.from('orders').delete().eq('id', insertedOrder.id);
      return Response.json({ message: 'Failed to save order items.' }, { status: 500 });
    }

    const resBody: SaveOrderResponse = {
      id: insertedOrder.id,
      slug: insertedOrder.slug,
    };
    return Response.json(resBody, { status: 201 });
  } catch (err) {
    console.error('[api/orders POST] unexpected error:', err);
    return Response.json(
      { message: err instanceof Error ? err.message : 'Failed to save order.' },
      { status: 500 },
    );
  }
}
