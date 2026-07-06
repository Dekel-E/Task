-- Realtime access. The browser subscribes to `postgres_changes` for live
-- message delivery and typing indicators, so `messages` and
-- `conversation_members` need member-scoped SELECT for the `authenticated`
-- role. All WRITES still go only through server route handlers (Drizzle over
-- DATABASE_URL, which bypasses RLS) — there are deliberately no INSERT/UPDATE
-- policies here.

-- Membership check as SECURITY DEFINER so a policy ON conversation_members can
-- call it WITHOUT recursively triggering that same policy (the function owner
-- bypasses RLS). Empty search_path + schema-qualified names is the safe form.
create or replace function public.is_member(conv uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conv
      and m.user_id = uid
  );
$$;

grant select on public.messages to authenticated;
grant select on public.conversation_members to authenticated;

-- A user can read messages only in conversations they belong to.
create policy "messages readable by members"
  on public.messages for select
  to authenticated
  using (public.is_member(conversation_id, auth.uid()));

-- A user can read the member rows (incl. last_typing_at) of their own
-- conversations. is_member is SECURITY DEFINER, so this does not recurse.
create policy "membership readable by members"
  on public.conversation_members for select
  to authenticated
  using (public.is_member(conversation_id, auth.uid()));

-- Emit full rows on UPDATE so typing-indicator subscribers receive the changed
-- last_typing_at column (composite-PK table needs FULL for complete payloads).
alter table public.conversation_members replica identity full;

-- Expose both tables on the Realtime publication.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
