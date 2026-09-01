-- Migration: Mollie-ready subscription schema + webhook idempotency
--
-- Safe to run against either a fresh database (no user_subscriptions table
-- yet) or one that already has the earlier Stripe-shaped version of it —
-- every statement below is idempotent (IF EXISTS / IF NOT EXISTS / CREATE
-- OR REPLACE), so running it twice, or running it after schema.sql already
-- created the old shape, does not error and does not duplicate anything.
--
-- Nothing in the application reads or writes user_subscriptions today, so
-- this migration does not touch any code path — verified by searching the
-- whole app/components/lib tree before writing this file.

-- 1. user_subscriptions: bring it to the final, provider-neutral shape.
create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  provider text not null default 'mollie',
  provider_customer_id text,
  provider_subscription_id text,
  plan_id text not null default 'free',
  status text not null default 'inactive',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Drop the old Stripe-specific columns if this table already existed in
-- its earlier shape. No-op on a freshly created table.
alter table public.user_subscriptions
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id;

-- Fill in any new columns if this table already existed but predates one
-- of them. No-op on a freshly created table (already has everything).
alter table public.user_subscriptions
  add column if not exists provider text not null default 'mollie',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists current_period_start timestamp with time zone,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can view their own subscription status." on public.user_subscriptions;
create policy "Users can view their own subscription status."
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy is created for user_subscriptions,
-- deliberately: with RLS enabled, an operation with no matching policy is
-- denied by default for the anon/authenticated roles. Only the
-- service-role key (server-side only, used by the future webhook handler)
-- can write to this table.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_subscriptions_updated_at on public.user_subscriptions;
create trigger set_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute procedure public.set_updated_at();


-- 2. payment_webhook_events: new idempotency ledger for inbound
--    payment-provider webhooks (Mollie today).
create table if not exists public.payment_webhook_events (
  id uuid default gen_random_uuid() primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (provider, event_id)
);

alter table public.payment_webhook_events enable row level security;

-- Intentionally zero policies on this table — see supabase/schema.sql for
-- the full rationale. No anon/authenticated client can read or write it;
-- only the service role can, and only from trusted server-side code.
