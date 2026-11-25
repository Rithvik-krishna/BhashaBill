-- BhashaBill Demo Seed Data (idempotent: safe to re-run)
-- Seeds 5 realistic orders: 2 paid, 2 pending, 1 overdue.

do $$
declare
  v_id uuid;
begin
  -- 1. Paid order (Kannada)
  insert into public.orders (slug, customer_name, customer_phone, language, transcript, total, advance_paid, due_date, due_date_text, status, created_at)
  values (
    'kaveri-diwali-101',
    'Kaveriappa',
    '919845011223',
    'kn',
    'ಕಾವೇರಿಯಪ್ಪ ಅವರಿಗೆ ಮೂರು ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್',
    1800.00,
    500.00,
    current_date - interval '2 days',
    'Two days ago',
    'paid',
    now() - interval '5 days'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.order_items (order_id, name_original, name_english, quantity, unit, rate, amount, sort_order)
    values (v_id, 'ಮೈಸೂರು ಪಾಕ್', 'Mysore Pak', 3, 'kg', 600.00, 1800.00, 0);

    insert into public.payments (order_id, amount, created_at)
    values (v_id, 1300.00, now() - interval '2 days');
  end if;

  -- 2. Paid order (Hindi)
  v_id := null;
  insert into public.orders (slug, customer_name, customer_phone, language, transcript, total, advance_paid, due_date, due_date_text, status, created_at)
  values (
    'rajesh-sharma-102',
    'Rajesh Sharma',
    '919811223344',
    'hi',
    'राजेश शर्मा जी के लिए एक किलो काजू कतली और एक किलो जलेबी',
    1450.00,
    1450.00,
    current_date - interval '1 day',
    'Yesterday',
    'paid',
    now() - interval '4 days'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.order_items (order_id, name_original, name_english, quantity, unit, rate, amount, sort_order)
    values
      (v_id, 'काजू कतली', 'Kaju Katli', 1, 'kg', 950.00, 950.00, 0),
      (v_id, 'जलेबी', 'Jalebi', 1, 'kg', 500.00, 500.00, 1);
  end if;

  -- 3. Pending order (Kannada)
  v_id := null;
  insert into public.orders (slug, customer_name, customer_phone, language, transcript, total, advance_paid, due_date, due_date_text, status, created_at)
  values (
    'ananya-rao-103',
    'Ananya Rao',
    '919900112233',
    'kn',
    'ಅನನ್ಯ ರಾವ್ ಅವರಿಗೆ ಒಂದು ಕೆಜಿ ಬಾದಾಮ್ ಹಲ್ವಾ ಮತ್ತು ಎರಡು ಕೆಜಿ ಚಕ್ಕುಲಿ',
    1650.00,
    500.00,
    current_date + interval '2 days',
    'In two days',
    'pending',
    now() - interval '1 day'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.order_items (order_id, name_original, name_english, quantity, unit, rate, amount, sort_order)
    values
      (v_id, 'ಬಾದಾಮ್ ಹಲ್ವಾ', 'Badam Halwa', 1, 'kg', 850.00, 850.00, 0),
      (v_id, 'ಚಕ್ಕುಲಿ', 'Chakli', 2, 'kg', 400.00, 800.00, 1);
  end if;

  -- 4. Pending order with partial payment (Hindi)
  v_id := null;
  insert into public.orders (slug, customer_name, customer_phone, language, transcript, total, advance_paid, due_date, due_date_text, status, created_at)
  values (
    'meena-devi-104',
    'Meena Devi',
    '919740556677',
    'hi',
    'मीना देवी के लिए दो किलो बेसन लड्डू और एक बॉक्स मोतीचूर',
    1100.00,
    300.00,
    current_date + interval '4 days',
    'This weekend',
    'pending',
    now() - interval '4 hours'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.order_items (order_id, name_original, name_english, quantity, unit, rate, amount, sort_order)
    values
      (v_id, 'बेसन लड्डू', 'Besan Laddu', 2, 'kg', 350.00, 700.00, 0),
      (v_id, 'मोतीचूर लड्डू', 'Motichoor Laddu', 1, 'box', 400.00, 400.00, 1);

    insert into public.payments (order_id, amount, created_at)
    values (v_id, 200.00, now() - interval '2 hours');
  end if;

  -- 5. Overdue order (Kannada)
  v_id := null;
  insert into public.orders (slug, customer_name, customer_phone, language, transcript, total, advance_paid, due_date, due_date_text, status, created_at)
  values (
    'suresh-gowda-105',
    'Suresh Gowda',
    '919880998877',
    'kn',
    'ಸುರೇಶ್ ಗೌಡ ಅವರಿಗೆ ನಾಲ್ಕು ಕೆಜಿ ಹೋಳಿಗೆ ಮತ್ತು ಒಂದು ಕೆಜಿ ಮೈಸೂರು ಪಾಕ್',
    2200.00,
    500.00,
    current_date - interval '3 days',
    'Three days ago',
    'pending',
    now() - interval '6 days'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.order_items (order_id, name_original, name_english, quantity, unit, rate, amount, sort_order)
    values
      (v_id, 'ಹೋಳಿಗೆ', 'Obbattu / Holige', 4, 'kg', 400.00, 1600.00, 0),
      (v_id, 'ಮೈಸೂರು ಪಾಕ್', 'Mysore Pak', 1, 'kg', 600.00, 600.00, 1);
  end if;
end $$;
