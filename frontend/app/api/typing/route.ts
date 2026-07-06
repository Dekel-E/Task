import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isMember } from "@/lib/chat";
import { db } from "@/lib/db";
import { conversationMembers } from "@/lib/db/schema";

// POST /api/typing { conversationId } — stamp last_typing_at for the caller. The
// UPDATE fires Realtime postgres_changes so other members see "typing…".
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { conversationId } = await request.json();
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 },
    );
  }
  if (!(await isMember(conversationId, me.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(conversationMembers)
    .set({ lastTypingAt: sql`now()` })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, me.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
