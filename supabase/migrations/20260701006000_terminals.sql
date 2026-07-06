-- Shared terminal sessions. Each `terminals` row is a saved terminal owned by
-- one user; `terminal_members` grants additional users access so they can
-- attach to the SAME live PTY (spawned by the FastAPI backend over a
-- WebSocket). Server-only via Drizzle (RLS on, no policies); the backend
-- authorizes a WS join by checking owner_id / terminal_members directly.

create table if not exists public.terminals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists terminals_owner_idx on public.terminals (owner_id);

create table if not exists public.terminal_members (
  terminal_id uuid not null references public.terminals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  added_at timestamptz not null default now(),
  primary key (terminal_id, user_id)
);

create index if not exists terminal_members_user_idx
  on public.terminal_members (user_id);

alter table public.terminals enable row level security;
alter table public.terminal_members enable row level security;
