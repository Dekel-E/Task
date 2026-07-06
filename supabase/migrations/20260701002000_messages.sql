-- Messages in a conversation. `body` is nullable so a message can be
-- attachment-only (see attachments). Sent via a server route handler; the
-- browser receives new rows live through Supabase Realtime `postgres_changes`
-- (SELECT opened to members in the realtime-RLS migration).

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text,
  -- Millisecond precision so the value round-trips through JSON exactly.
  created_at timestamptz not null default date_trunc('milliseconds', now())
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;
