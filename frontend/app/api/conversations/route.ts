import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isMember } from "@/lib/chat";
import { isContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import {
  conversation,
  conversationMembers,
  groups,
  messages,
  users,
} from "@/lib/db/schema";

// GET /api/conversations — the signed-in user's chat list. Each entry carries a
// display title (group name, or the other DM member's name) and a last-message
// preview for the list UI.
export async function GET() {
  const me = await getUser();
  if (!me) return unauthorized();

  // Conversations I belong to (with my per-user cleared_at, if I hid it).
  const myMemberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      clearedAt: conversationMembers.clearedAt,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, me.id));
  const convIds = myMemberships.map((m) => m.conversationId);
  if (convIds.length === 0) return NextResponse.json([]);
  const clearedByConv = new Map(
    myMemberships.map((m) => [m.conversationId, m.clearedAt]),
  );

  const convs = await db
    .select()
    .from(conversation)
    .where(inArray(conversation.id, convIds));

  const groupRows = await db
    .select()
    .from(groups)
    .where(inArray(groups.conversationId, convIds));
  const groupByConv = new Map(groupRows.map((g) => [g.conversationId, g]));

  // The "other" member of each DM (for the title/avatar).
  const otherMembers = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: users.id,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(
      and(
        inArray(conversationMembers.conversationId, convIds),
        ne(conversationMembers.userId, me.id),
      ),
    );
  const othersByConv = new Map<string, (typeof otherMembers)[number][]>();
  for (const row of otherMembers) {
    const list = othersByConv.get(row.conversationId) ?? [];
    list.push(row);
    othersByConv.set(row.conversationId, list);
  }

  // Latest message per conversation (Postgres DISTINCT ON).
  const lastMsgs = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(messages.conversationId, desc(messages.createdAt));
  const lastByConv = new Map(lastMsgs.map((m) => [m.conversationId, m]));

  // Hide conversations the caller has cleared, unless a message arrived after
  // they cleared it (which brings it back into their list).
  const visibleConvs = convs.filter((c) => {
    const cleared = clearedByConv.get(c.id);
    if (!cleared) return true;
    const last = lastByConv.get(c.id);
    return (
      !!last &&
      new Date(last.createdAt).getTime() > new Date(cleared).getTime()
    );
  });

  const result = visibleConvs.map((c) => {
    const others = othersByConv.get(c.id) ?? [];
    const group = groupByConv.get(c.id);
    const title =
      c.type === "group"
        ? (group?.name ?? "Group")
        : (others[0]?.displayName ?? "Unknown");
    const last = lastByConv.get(c.id) ?? null;
    return {
      id: c.id,
      type: c.type,
      title,
      otherUserId: c.type === "dm" ? (others[0]?.userId ?? null) : null,
      lastMessage: last
        ? { body: last.body, createdAt: last.createdAt, senderId: last.senderId }
        : null,
    };
  });

  // Most recently active first (conversations with a message, by message time;
  // then the rest by creation).
  result.sort((a, b) => {
    const at = a.lastMessage?.createdAt
      ? new Date(a.lastMessage.createdAt).getTime()
      : 0;
    const bt = b.lastMessage?.createdAt
      ? new Date(b.lastMessage.createdAt).getTime()
      : 0;
    return bt - at;
  });

  return NextResponse.json(result);
}

// POST /api/conversations { userId } — open (or create) the 1:1 DM with userId.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (userId === me.id) {
    return NextResponse.json(
      { error: "cannot DM yourself" },
      { status: 400 },
    );
  }
  // You may only start a DM with someone on your contact list.
  if (!(await isContact(me.id, userId))) {
    return NextResponse.json(
      { error: "You can only message your contacts" },
      { status: 403 },
    );
  }

  // Existing DM: a type='dm' conversation whose exactly-two members are us both.
  const existing = await db.execute(sql`
    select c.id
    from ${conversation} c
    join ${conversationMembers} m on m.conversation_id = c.id
    where c.type = 'dm'
      and m.user_id in (${me.id}, ${userId})
    group by c.id
    having count(distinct m.user_id) = 2
    limit 1
  `);
  const existingId = (existing as unknown as { id: string }[])[0]?.id;
  if (existingId) return NextResponse.json({ id: existingId });

  // Otherwise create it with both members.
  const id = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversation)
      .values({ type: "dm", createdBy: me.id })
      .returning({ id: conversation.id });
    await tx.insert(conversationMembers).values([
      { conversationId: conv.id, userId: me.id, role: "member" },
      { conversationId: conv.id, userId, role: "member" },
    ]);
    return conv.id;
  });

  return NextResponse.json({ id });
}

// DELETE /api/conversations { conversationId } — "delete chat" for the caller
// ONLY. Per-user space: we stamp the caller's own membership (cleared_at) so the
// chat disappears from their list and their history is cleared for them; the
// other member and the shared messages are untouched. A new message after this
// point brings the chat back for the caller.
export async function DELETE(request: Request) {
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
    .set({ clearedAt: new Date() })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, me.id),
      ),
    );
  return NextResponse.json({ ok: true });
}
