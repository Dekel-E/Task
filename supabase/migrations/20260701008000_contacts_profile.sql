-- Contacts + profile status.
--
-- Users no longer see everyone: each user builds a private contact list and may
-- only DM / add-to-group people on it. Contacts are one-directional (you add
-- someone by email). Server-only (RLS on, no policies) — route handlers manage
-- it via the Drizzle connection.

create table if not exists public.contacts (
  owner_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  constraint contacts_no_self check (owner_id <> contact_id)
);

create index if not exists contacts_owner_idx on public.contacts (owner_id);

alter table public.contacts enable row level security;

-- Profile "about" / status line, editable by the user (WhatsApp's About).
alter table public.users
  add column if not exists status_text text not null
  default 'Hey there! I am using WhatsApp+.';
