-- App-facing user identity. Supabase Auth owns credentials in `auth.users`;
-- this `public.users` table owns the fields the app renders (display name,
-- avatar, presence). One row per auth account, kept in sync by a trigger.
--
-- Canonical source of truth — mirror any change into frontend/lib/db/schema.ts.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_path text,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- PostgREST checks table privileges in addition to RLS.
grant select, update on public.users to authenticated;

-- Any signed-in user can read profiles (needed to find people to chat with).
create policy "users readable by authenticated"
  on public.users for select
  to authenticated
  using (true);

-- A user may update only their own row (e.g. display name, last_seen).
create policy "users update own row"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a `users` row whenever an auth account is created. Display name
-- comes from signup metadata (options.data.display_name); falls back to the
-- email local-part so the row is always valid. SECURITY DEFINER + empty
-- search_path is the Supabase-recommended safe form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
