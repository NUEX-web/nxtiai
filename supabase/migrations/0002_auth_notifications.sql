-- Auth notification dedup columns on profiles.
--
-- Backs lib/server/auth-notify.ts. Both columns are written exclusively
-- by trusted server-side code (the user's own cookie-scoped session, via
-- the existing "Users can update their own profile." RLS policy -- no
-- new policy needed) and read by nothing client-facing that treats them
-- as anything but internal bookkeeping.
--
-- welcome_email_sent_at: set exactly once, the first time a user's
-- account is confirmed genuinely usable (an email-confirmation link
-- click or a first successful sign-in of any kind, whichever happens
-- first -- see notifyAuthEvent). Gates the one-time customer welcome
-- email + the one-time admin "new signup" alert so neither ever fires
-- twice for the same account.
--
-- last_login_notified_session_id: the auth.sessions session id embedded
-- as a claim in the user's JWT (stable across token refreshes, unique
-- per distinct sign-in). Gates the per-login customer + admin emails so
-- a token refresh, a page reload, or the same SIGNED_IN event replaying
-- across multiple open browser tabs never re-sends mail for what is
-- really one login.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists last_login_notified_session_id text;
