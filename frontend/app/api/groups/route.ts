import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isAdmin, isMember } from "@/lib/chat";
import { isContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import {
  conversation,
  conversationMembers,
  groups,
  users,
} from "@/lib/db/schema";

// GET /api/groups?conversationId=... — group metadata + members (for the info
// page). Any member may read.
export async function GET(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 },
    );
  }
  if (!(await isMember(conversationId, me.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.conversationId, conversationId))
    .limit(1);
  if (!group) {
    return NextResponse.json({ error: "Not a group" }, { status: 404 });
  }

  const members = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      role: conversationMembers.role,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId));

  const myRole =
    members.find((m) => m.userId === me.id)?.role ?? "member";

  const creatorName =
    members.find((m) => m.userId === group.createdBy)?.displayName ?? null;

  return NextResponse.json({
    conversationId,
    name: group.name,
    createdBy: group.createdBy,
    creatorName,
    createdAt: group.createdAt,
    myRole,
    members,
  });
}

// PATCH /api/groups { conversationId, name } — rename a group (admins only).
export async function PATCH(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { conversationId, name } = await request.json();
  if (!conversationId || !name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "conversationId and name required" },
      { status: 400 },
    );
  }
  if (!(await isAdmin(conversationId, me.id))) {
    return NextResponse.json({ error: "admins only" }, { status: 403 });
  }

  await db
    .update(groups)
    .set({ name: name.trim().slice(0, 80) })
    .where(eq(groups.conversationId, conversationId));

  return NextResponse.json({ ok: true });
}

// POST /api/groups { name, memberIds[] } — create a group conversation with the
// caller as admin and the given users as members.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { name, memberIds } = await request.json();
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const others: string[] = Array.isArray(memberIds)
    ? memberIds.filter((id) => typeof id === "string" && id !== me.id)
    : [];

  // Every added member must be one of the creator's contacts.
  for (const uid of others) {
    if (!(await isContact(me.id, uid))) {
      return NextResponse.json(
        { error: "You can only add your contacts to a group" },
        { status: 403 },
      );
    }
  }

  const conversationId = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversation)
      .values({ type: "group", createdBy: me.id })
      .returning({ id: conversation.id });
    await tx
      .insert(groups)
      .values({ conversationId: conv.id, name: name.trim(), createdBy: me.id });
    await tx.insert(conversationMembers).values([
      { conversationId: conv.id, userId: me.id, role: "admin" },
      ...others.map((userId) => ({
        conversationId: conv.id,
        userId,
        role: "member",
      })),
    ]);
    return conv.id;
  });

  return NextResponse.json({ id: conversationId });
}
