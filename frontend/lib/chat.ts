import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { conversationMembers } from "@/lib/db/schema";

// Membership row for (conversation, user), or null. Used by route handlers to
// authorize reads/writes — the browser can never write chat data directly.
export async function getMembership(conversationId: string, userId: string) {
  const rows = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function isMember(conversationId: string, userId: string) {
  return (await getMembership(conversationId, userId)) !== null;
}

export async function isAdmin(conversationId: string, userId: string) {
  const m = await getMembership(conversationId, userId);
  return m?.role === "admin";
}
