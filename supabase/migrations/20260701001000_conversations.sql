-- A conversation is either a 1:1 'dm' or a 'group'. Membership lives in
-- conversation_members (a DM has two rows; a group has N). Both DMs and groups
-- reuse these tables; groups additionally carry a metadata row (see groups).
--
-- Writes go only through server route handlers (Drizzle over DATABASE_URL,
-- which bypasses RLS). The browser never writes here. `conversation_members`
-- is opened for SELECT to the browser later (realtime typing) in the
-- realtime-RLS migration; `conversation` itself stays server-only.

create table if not exists public.conversation (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'dm' check (type in ('dm', 'group')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversation (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  last_read_at timestamptz,
  last_typing_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

alter table public.conversation enable row level security;
alter table public.conversation_members enable row level security;
