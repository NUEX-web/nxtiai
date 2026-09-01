-- NXTIAI Supabase Database Schema
-- Run this script in your Supabase SQL Editor to create tables and RLS policies.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  plan_tier text not null default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile."
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile."
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Custom Voice Profiles Table
create table if not exists public.custom_voices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  tone text not null default 'neutral',
  formality text not null default 'neutral',
  vocabulary_level text not null default 'standard',
  custom_instructions text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on custom_voices
alter table public.custom_voices enable row level security;

create policy "Users can view their own voices."
  on public.custom_voices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own voices."
  on public.custom_voices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own voices."
  on public.custom_voices for update
  using (auth.uid() = user_id);

create policy "Users can delete their own voices."
  on public.custom_voices for delete
  using (auth.uid() = user_id);


-- 3. Rewrites History Table
create table if not exists public.rewrites_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  input_text text not null,
  output_text text not null,
  mode text not null,
  voice text not null,
  ai_model text not null,
  language text not null,
  latency_ms integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on rewrites_history
alter table public.rewrites_history enable row level security;

create policy "Users can view their own rewrite history."
  on public.rewrites_history for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own rewrite history."
  on public.rewrites_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own rewrite history."
  on public.rewrites_history for delete
  using (auth.uid() = user_id);


-- 4. Subscriptions Table
--
-- Provider-neutral by design (NXTIAI's payment provider is Mollie — see
-- lib/server/payments/provider.ts — but nothing here is Mollie-specific,
-- so a future provider change never means a schema change). Nothing in
-- the application reads or writes this table yet; it is written to
-- exclusively by trusted server-side code (the future webhook handler,
-- using the Supabase service-role key, which bypasses RLS by design) once
-- it has independently verified a payment/subscription state with the
-- provider's own API — never from the browser, and never from an
-- unverified webhook payload alone.
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

-- Enable RLS on user_subscriptions
alter table public.user_subscriptions enable row level security;

-- Customers may only ever SELECT their own subscription row. Deliberately
-- no insert/update/delete policy for the authenticated role: with RLS
-- enabled, an operation with no matching policy is denied by default, so
-- normal users cannot grant themselves a plan by writing to this table
-- directly — only the service role (server-side only) can write to it.
create policy "Users can view their own subscription status."
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- Keep updated_at honest on every server-side write, without relying on
-- application code to remember to set it.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create or replace trigger set_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute procedure public.set_updated_at();


-- 5. Payment Webhook Events Table
--
-- Idempotency ledger for inbound payment-provider webhooks (Mollie today).
-- Every event id NXTIAI has processed is recorded here before/while acting
-- on it, so a webhook Mollie sends more than once — which Mollie, like any
-- webhook sender, can legitimately do — never results in a duplicate
-- subscription update, confirmation email, or PDF. Trusted server-side
-- table only: no client of any kind, authenticated or not, can read or
-- write it.
create table if not exists public.payment_webhook_events (
  id uuid default gen_random_uuid() primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (provider, event_id)
);

-- Enable RLS on payment_webhook_events
alter table public.payment_webhook_events enable row level security;

-- Intentionally zero policies. With RLS enabled and no policy defined for
-- any role/operation, every access from the anon or authenticated roles is
-- denied by default — this table is reachable only by the service role,
-- which Supabase uses server-side and which bypasses RLS entirely by
-- design. That's the point: this ledger is for trusted webhook processing
-- only, never for anything a browser session could touch.
