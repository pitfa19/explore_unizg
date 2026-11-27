-- Visitor reports from the playground. Apply in the Supabase SQL editor or via the CLI.
-- The API writes with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- RLS is on and there are no policies, so the anon and authenticated roles cannot read or insert.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  email text,
  context jsonb not null default '{}'::jsonb,
  page text,
  user_agent text,
  constraint feedback_message_len check (char_length(message) between 1 and 2000),
  constraint feedback_email_len check (email is null or char_length(email) <= 200)
);

alter table public.feedback enable row level security;

comment on table public.feedback is 'Reports from Prijavi grešku. Written only by the service role.';
