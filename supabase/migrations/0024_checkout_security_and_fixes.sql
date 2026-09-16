-- Security audit follow-up. Three real, exploitable issues plus a handful of
-- smaller fixes bundled into one migration:
--
-- 1. `create_order` trusted the client-supplied price/title for every line
--    item instead of reading `products.price` -- a buyer could edit their
--    cart's price in the browser (or call the RPC directly) and pay
--    whatever they chose, and the M-Pesa STK push would charge that same
--    tampered amount. Fixed by reading price/title from `products` inside
--    the same row-locked loop that already checks stock.
-- 2. Abandoned checkouts (STK push never completed, tab closed, guest never
--    returns) reserved stock forever -- nothing ever expired a stale
--    `pending_payment` order. Fixed with a self-healing sweep at the top of
--    `create_order` that expires anything older than 20 minutes on every
--    checkout attempt, which restocks it via the existing
--    `restock_on_order_failure` trigger. No cron dependency required.
-- 3. Flipping an order's status back and forth (e.g. an admin correcting a
--    mistake) could re-send the "payment received" / "order shipped" email
--    every time it re-entered that status. Fixed with per-order
--    notified_paid/notified_shipped flags so each email fires at most once.
--
-- Also: newsletter signups had no admin read policy at all (insert-only),
-- get_admin_dashboard_stats was the only admin RPC not security-definer,
-- reviews had no path for a customer to fix and resubmit a rejected review,
-- pending reviews never notified anyone, referral reward amounts were
-- hardcoded in two places (a migration and the frontend), and donation
-- pickup requests captured no actual date/address. All addressed below.

-- 1 & 2: create_order -----------------------------------------------------

create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_items jsonb,
  p_apply_credit boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_total numeric(10, 2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
  v_price numeric(10, 2);
  v_title text;
  v_stock int;
  v_credit_available numeric(10, 2) := 0;
  v_credit_applied numeric(10, 2) := 0;
begin
  update public.orders
  set status = 'payment_failed'
  where status = 'pending_payment' and created_at < now() - interval '20 minutes';

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items) order by (value ->> 'product_id')
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for one of the items in your cart';
    end if;

    -- Price and title always come from the products table itself, locked
    -- for update, never from client-supplied JSON.
    select stock, price, title into v_stock, v_price, v_title
    from public.products
    where id = v_product_id and status = 'published'
    for update;

    if v_stock is null then
      raise exception 'One of the items in your cart is no longer available';
    end if;

    if v_stock < v_qty then
      raise exception 'Only % left of "%"', v_stock, v_title;
    end if;

    update public.products set stock = stock - v_qty where id = v_product_id;

    v_total := v_total + (v_price * v_qty);
  end loop;

  if p_apply_credit and auth.uid() is not null then
    select credit_balance into v_credit_available from public.profiles where id = auth.uid();
    v_credit_applied := least(coalesce(v_credit_available, 0), v_total);
  end if;

  insert into public.orders (
    id, user_id, total_amount, credit_applied, customer_name, customer_phone, customer_email, shipping_address
  )
  values (
    v_order_id, auth.uid(), v_total - v_credit_applied, v_credit_applied,
    p_customer_name, p_customer_phone, p_customer_email, p_shipping_address
  );

  if v_credit_applied > 0 then
    update public.profiles set credit_balance = credit_balance - v_credit_applied where id = auth.uid();
  end if;

  insert into public.order_items (order_id, product_id, title, price, quantity)
  select v_order_id, p.id, p.title, p.price, (v.value ->> 'quantity')::int
  from jsonb_array_elements(p_items) v
  join public.products p on p.id = (v.value ->> 'product_id')::uuid;

  return v_order_id;
end;
$$;

-- Guest-safe line-item lookup for the order confirmation page (mirrors
-- get_order_by_id from migration 0009 -- same "know the id" access model).
create function public.get_order_items_by_order_id(p_order_id uuid)
returns setof public.order_items
language sql
security definer
set search_path = public
stable
as $$
  select oi.* from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.order_id = p_order_id
    and (o.user_id is null or o.user_id = auth.uid() or public.is_admin());
$$;

grant execute on function public.get_order_items_by_order_id(uuid) to anon, authenticated;

-- 3: at-most-once payment/shipping emails ----------------------------------

alter table public.orders add column notified_paid boolean not null default false;
alter table public.orders add column notified_shipped boolean not null default false;

drop trigger if exists email_on_order_change on public.orders;
drop function if exists public.notify_order_email();

create function public.notify_order_email_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.queue_transactional_email(
    'order_confirmation',
    new.customer_email,
    'order',
    new.id,
    jsonb_build_object(
      'customerName', new.customer_name,
      'orderId', new.id,
      'totalAmount', new.total_amount,
      'shippingAddress', new.shipping_address
    )
  );
  return new;
end;
$$;

create trigger email_on_order_insert
  after insert on public.orders
  for each row execute procedure public.notify_order_email_on_insert();

create function public.notify_order_email_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and not coalesce(old.notified_paid, false) then
    perform public.queue_transactional_email(
      'order_paid',
      new.customer_email,
      'order',
      new.id,
      jsonb_build_object(
        'customerName', new.customer_name,
        'orderId', new.id,
        'totalAmount', new.total_amount,
        'mpesaReceipt', new.mpesa_receipt_number
      )
    );
    new.notified_paid := true;
  end if;

  if new.status = 'shipped' and old.status is distinct from 'shipped' and not coalesce(old.notified_shipped, false) then
    perform public.queue_transactional_email(
      'order_shipped',
      new.customer_email,
      'order',
      new.id,
      jsonb_build_object(
        'customerName', new.customer_name,
        'orderId', new.id,
        'shippingCarrier', new.shipping_carrier,
        'trackingNumber', new.tracking_number
      )
    );
    new.notified_shipped := true;
  end if;

  return new;
end;
$$;

create trigger email_on_order_update
  before update on public.orders
  for each row execute procedure public.notify_order_email_on_update();

-- Newsletter: admins could never read the list they were collecting -------

create policy "admins can view newsletter signups"
  on public.newsletter_signups for select
  using (public.is_admin());

-- Dashboard stats: the one admin RPC that wasn't security-definer ---------
-- (harmless today since it only aggregates what the caller's own RLS
-- already lets them see, but inconsistent with every other admin function,
-- and fragile if a future policy change loosens caller-side visibility).

create or replace function public.get_admin_dashboard_stats()
returns table(
  total_revenue numeric,
  paid_orders_count bigint,
  total_orders_count bigint,
  donations_count bigint,
  pending_donations_count bigint,
  pending_partner_applications_count bigint,
  published_products_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    return query select 0::numeric, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    (select coalesce(sum(total_amount), 0) from public.orders where status = 'paid'),
    (select count(*) from public.orders where status = 'paid'),
    (select count(*) from public.orders),
    (select count(*) from public.donations),
    (select count(*) from public.donations where status = 'submitted'),
    (select count(*) from public.partner_applications where status = 'pending'),
    (select count(*) from public.products where status = 'published');
end;
$$;

-- Referral reward amounts: one source of truth instead of a number
-- hardcoded separately in this migration chain and in the frontend copy.

create function public.get_referral_reward_amounts()
returns table(referrer_reward numeric, referee_reward numeric)
language sql
stable
as $$
  select 200::numeric, 100::numeric;
$$;

grant execute on function public.get_referral_reward_amounts() to anon, authenticated;

create or replace function public.grant_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_already_granted boolean;
  v_referrer_email text;
  v_referee_email text;
  v_referrer_reward numeric;
  v_referee_reward numeric;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.user_id is not null then
    select referred_by, referral_reward_granted into v_referrer_id, v_already_granted
    from public.profiles where id = new.user_id;

    if v_referrer_id is not null and not v_already_granted then
      select referrer_reward, referee_reward into v_referrer_reward, v_referee_reward
      from public.get_referral_reward_amounts();

      update public.profiles set credit_balance = credit_balance + v_referrer_reward where id = v_referrer_id;
      update public.profiles set credit_balance = credit_balance + v_referee_reward, referral_reward_granted = true
        where id = new.user_id;

      select email into v_referrer_email from auth.users where id = v_referrer_id;
      select email into v_referee_email from auth.users where id = new.user_id;

      perform public.queue_transactional_email(
        'referral_reward_referrer', v_referrer_email, 'order', new.id,
        jsonb_build_object('amount', v_referrer_reward)
      );
      perform public.queue_transactional_email(
        'referral_reward_referee', v_referee_email, 'order', new.id,
        jsonb_build_object('amount', v_referee_reward)
      );
    end if;
  end if;
  return new;
end;
$$;

-- Reviews: rejection reason + a resubmit path ------------------------------

alter table public.reviews add column rejection_reason text;

-- A reviewer can move their own rejected review back to pending (editing
-- rating/title/body along the way), but can never set status to anything
-- else themselves -- self-approval stays impossible. Combined with the
-- existing admin policy via Postgres's OR'd permissive-policy evaluation.
create policy "reviewers can resubmit their rejected review"
  on public.reviews for update
  using (auth.uid() = user_id and status = 'rejected')
  with check (auth.uid() = user_id and status = 'pending');

-- Postgres won't let CREATE OR REPLACE change a table-returning function's
-- output columns (we're adding rejection_reason) -- must drop it first.
drop function if exists public.list_reviews_for_moderation();

create function public.list_reviews_for_moderation()
returns table (
  id uuid,
  product_id uuid,
  product_title text,
  rating int,
  review_title text,
  review_body text,
  verified_purchase boolean,
  status text,
  rejection_reason text,
  reviewer_name text,
  reviewer_email text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.product_id, pr.title, r.rating, r.title, r.body, r.verified_purchase, r.status,
         r.rejection_reason, coalesce(p.full_name, 'Unknown'), u.email, r.created_at
  from public.reviews r
  join public.products pr on pr.id = r.product_id
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by (r.status = 'pending') desc, r.created_at desc;
$$;

-- Dropping the function above also drops its prior grant -- restore it.
grant execute on function public.list_reviews_for_moderation() to authenticated;

-- Notify every admin when a review needs moderation, matching the pattern
-- already used for donations and partner applications.
create function public.notify_review_pending_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
  v_product_title text;
begin
  if new.status = 'pending' then
    select title into v_product_title from public.products where id = new.product_id;
    for v_admin in
      select u.email from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin'
    loop
      perform public.queue_transactional_email(
        'review_pending_moderation', v_admin.email, 'review', new.id,
        jsonb_build_object('productTitle', v_product_title)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger email_on_review_pending
  after insert on public.reviews
  for each row execute procedure public.notify_review_pending_email();

-- Donations: real pickup date/address instead of a bare boolean ----------

alter table public.donations add column pickup_date date;
alter table public.donations add column pickup_address text;

-- mpesa-initiate rate limiting ---------------------------------------------
-- Written to exclusively by the mpesa-initiate edge function via the
-- service role -- no RLS policies means no client (anon or authenticated)
-- can read or write this table directly.
create table public.mpesa_initiate_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text,
  order_id uuid,
  created_at timestamptz not null default now()
);

alter table public.mpesa_initiate_attempts enable row level security;

create index mpesa_initiate_attempts_ip_created_at_idx
  on public.mpesa_initiate_attempts (ip, created_at);
