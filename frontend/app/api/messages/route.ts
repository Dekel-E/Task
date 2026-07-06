import { and, asc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { getMembership, isMember } from "@/lib/chat";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/db/schema";

// GET /api/messages?conversationId=... — full history for a conversation the
// caller belongs to (membership enforced here, not by the browser).
export async function GET(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  // Optional incremental fetch: only messages newer than this ISO timestamp.
  // Used by the client's realtime-fallback poll to fetch just what's new.
  const after = url.searchParams.get("after");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 },
    );
  }
  // Membership check + the caller's own "cleared" cutoff (per-user history).
  const membership = await getMembership(conversationId, me.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderName: users.displayName,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        // If the caller cleared this chat, only show messages sent afterwards.
        membership.clearedAt
          ? gt(messages.createdAt, membership.clearedAt)
          : undefined,
        after ? gt(messages.createdAt, new Date(after)) : undefined,
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(500);

  return NextResponse.json(rows);
}

// POST /api/messages { conversationId, body } — send a message. The insert
// triggers a Realtime postgres_changes INSERT that other members receive live.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { conversationId, body } = await request.json();
  if (!conversationId || typeof body !== "string" || body.trim() === "") {
    return NextResponse.json(
      { error: "conversationId and non-empty body required" },
      { status: 400 },
    );
  }
  if (!(await isMember(conversationId, me.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [msg] = await db
    .insert(messages)
    .values({ conversationId, senderId: me.id, body: body.trim() })
    .returning();

  return NextResponse.json(msg);
}
