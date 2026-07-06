-- File attached to a message. Bytes live in a PRIVATE Supabase Storage bucket;
-- this table holds metadata and links each file to its message. Server-only
-- via Drizzle (RLS on, no policies); route handlers gate access by membership
-- and upload/serve through the service role + short-lived signed URLs.

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete cascade,
  uploader_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('image', 'file')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists attachments_message_idx
  on public.attachments (message_id);

alter table public.attachments enable row level security;

-- Private bucket for attachment (and status) files. Access is brokered by the
-- backend using the service role; nothing is publicly readable.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
