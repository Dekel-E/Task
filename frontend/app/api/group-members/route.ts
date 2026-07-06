import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isAdmin, isMember } from "@/lib/chat";
import { isContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import { conversation, conversationMembers } from "@/lib/db/schema";

async function requireGroupAdmin(conversationId: string, userId: string) {
  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);
  if (!conv || conv.type !== "group") return "not-a-group";
  if (!(await isAdmin(conversationId, userId))) return "not-admin";
  return "ok";
}

// POST /api/group-members { conversationId, userId } — admin adds a member.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { conversationId, userId } = await request.json();
  if (!conversationId || !userId) {
    return NextResponse.json(
      { error: "conversationId and userId required" },
      { status: 400 },
    );
  }
  const check = await requireGroupAdmin(conversationId, me.id);
  if (check !== "ok") {
    return NextResponse.json({ error: check }, { status: 403 });
  }
  if (!(await isContact(me.id, userId))) {
    return NextResponse.json(
      { error: "You can only add your contacts" },
      { status: 403 },
    );
  }
  if (await isMember(conversationId, userId)) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  await db
    .insert(conversationMembers)
    .values({ conversationId, userId, role: "member" });
  return NextResponse.json({ ok: true });
}

// DELETE /api/group-members { conversationId, userId } — admin removes a member,
// or a member removes themselves (leave).
export async function DELETE(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { conversationId, userId } = await request.json();
  if (!conversationId || !userId) {
    return NextResponse.json(
      { error: "conversationId and userId required" },
      { status: 400 },
    );
  }

  const removingSelf = userId === me.id;
  if (!removingSelf) {
    const check = await requireGroupAdmin(conversationId, me.id);
    if (check !== "ok") {
      return NextResponse.json({ error: check }, { status: 403 });
    }
  } else if (!(await isMember(conversationId, me.id))) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );

  // Keep the group in a valid state after a departure:
  //  - if nobody is left, remove the now-empty conversation (cascades group +
  //    messages) so it doesn't linger as an orphan;
  //  - if no admin remains, promote the earliest-joined member so the group
  //    stays manageable (rename / add / remove).
  const remaining = await db
    .select({
      userId: conversationMembers.userId,
      role: conversationMembers.role,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId))
    .orderBy(asc(conversationMembers.joinedAt));

  if (remaining.length === 0) {
    await db.delete(conversation).where(eq(conversation.id, conversationId));
  } else if (!remaining.some((m) => m.role === "admin")) {
    await db
      .update(conversationMembers)
      .set({ role: "admin" })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, remaining[0].userId),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}
