-- Donor-experience audit follow-up. The donation flow had a real structural
-- gap: guest donors (no account) had no contact info collected at all, yet
-- the UI promised "we'll follow up by email" -- a promise that was
-- impossible to keep, since notify_donation_email() only had an email
-- address to send to when the donor happened to be signed in. On top of
-- that, a donation got exactly one email ever (acknowledgement at
-- submission) regardless of how far it progressed, and there was no way
-- for a donor to ever learn their item became a specific marketplace
-- product, even though that link is exactly what product_donations
-- already records.

-- 1. Contact info -----------------------------------------------------------

alter table public.donations add column contact_name text;
alter table public.donations add column contact_phone text;
alter table public.donations add column contact_email text;

-- Deliberately no NOT NULL / CHECK constraint requiring contact_phone: a
-- CHECK constraint (even added NOT VALID) is re-evaluated against the
-- *entire* row on every future UPDATE, not just the columns being
-- changed -- so it would silently block admins from ever progressing the
-- status of any donation submitted before this migration (25 real rows
-- today, none of which have a phone number, since the column didn't
-- exist yet). "Phone required" is enforced at the form-validation layer
-- for new submissions instead, matching how this schema already treats
-- guest-contact fields elsewhere.

-- 2. Acknowledgement email now prefers the donor-supplied contact email,
--    falling back to the account email for signed-in donors who didn't
--    retype it (kept optional -- phone is the required channel now).

create or replace function public.notify_donation_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := new.contact_email;
  if v_email is null and new.user_id is not null then
    select email into v_email from auth.users where id = new.user_id;
  end if;

  perform public.queue_transactional_email(
    'donation_acknowledgement',
    v_email,
    'donation',
    new.id,
    jsonb_build_object(
      'title', new.title,
      'category', new.category,
      'pickupRequested', new.pickup_requested
    )
  );
  return new;
end;
$$;

-- 3. Status-change notifications, matching the order lifecycle's
--    at-most-once-per-status pattern (migration 0024).

alter table public.donations add column notified_scheduled boolean not null default false;
alter table public.donations add column notified_collected boolean not null default false;
alter table public.donations add column notified_processed boolean not null default false;

create function public.notify_donation_status_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := new.contact_email;
  if v_email is null and new.user_id is not null then
    select email into v_email from auth.users where id = new.user_id;
  end if;

  if new.status = 'scheduled' and old.status is distinct from 'scheduled' and not coalesce(old.notified_scheduled, false) then
    perform public.queue_transactional_email(
      'donation_scheduled', v_email, 'donation', new.id,
      jsonb_build_object('title', new.title, 'pickupDate', new.pickup_date)
    );
    new.notified_scheduled := true;
  end if;

  if new.status = 'collected' and old.status is distinct from 'collected' and not coalesce(old.notified_collected, false) then
    perform public.queue_transactional_email(
      'donation_collected', v_email, 'donation', new.id,
      jsonb_build_object('title', new.title)
    );
    new.notified_collected := true;
  end if;

  if new.status = 'processed' and old.status is distinct from 'processed' and not coalesce(old.notified_processed, false) then
    perform public.queue_transactional_email(
      'donation_processed', v_email, 'donation', new.id,
      jsonb_build_object('title', new.title)
    );
    new.notified_processed := true;
  end if;

  return new;
end;
$$;

create trigger email_on_donation_status_change
  before update on public.donations
  for each row execute procedure public.notify_donation_status_email();

-- 4. Tell the donor when their donation becomes a specific product -- the
--    one moment this platform's architecture makes possible that no other
--    thrift/resale app can offer, previously never surfaced to the donor
--    who'd actually care most about it.

create function public.notify_donation_linked_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_donation_user_id uuid;
  v_donation_contact_email text;
  v_donation_title text;
  v_product_title text;
  v_product_slug text;
begin
  select contact_email, user_id, title into v_donation_contact_email, v_donation_user_id, v_donation_title
  from public.donations where id = new.donation_id;

  v_email := v_donation_contact_email;
  if v_email is null and v_donation_user_id is not null then
    select email into v_email from auth.users where id = v_donation_user_id;
  end if;

  select title, slug into v_product_title, v_product_slug
  from public.products where id = new.product_id;

  perform public.queue_transactional_email(
    'donation_became_product', v_email, 'donation', new.donation_id,
    jsonb_build_object('donationTitle', v_donation_title, 'productTitle', v_product_title, 'productSlug', v_product_slug)
  );
  return new;
end;
$$;

create trigger email_on_donation_linked_to_product
  after insert on public.product_donations
  for each row execute procedure public.notify_donation_linked_email();

-- 5. Let a signed-in donor see which of their own donations became which
--    product -- scoped to their own donations only via auth.uid(), same
--    "know your own row" access model used throughout this schema.

create function public.get_my_donation_products()
returns table(donation_id uuid, product_title text, product_slug text)
language sql
security definer
set search_path = public
stable
as $$
  select pd.donation_id, p.title, p.slug
  from public.product_donations pd
  join public.products p on p.id = pd.product_id
  join public.donations d on d.id = pd.donation_id
  where d.user_id = auth.uid();
$$;

grant execute on function public.get_my_donation_products() to authenticated;
