-- Per-user "delete chat". Deleting a chat must NOT destroy the shared
-- conversation for the other member — each user has their own space. Instead we
-- stamp the caller's own membership row: cleared_at hides the conversation from
-- their list and clears their view of the history (messages at/older than
-- cleared_at are not returned to them). The other member is unaffected, and a
-- new message (created after cleared_at) un-hides it, WhatsApp-style. Membership
-- itself is unchanged.
alter table public.conversation_members
  add column if not exists cleared_at timestamptz;
