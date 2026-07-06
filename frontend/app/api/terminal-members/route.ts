import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import { terminalMembers, terminals, users } from "@/lib/db/schema";

async function loadTerminal(terminalId: string) {
  const [t] = await db
    .select()
    .from(terminals)
    .where(eq(terminals.id, terminalId))
    .limit(1);
  return t ?? null;
}

async function isTerminalMember(terminalId: string, userId: string) {
  const [m] = await db
    .select()
    .from(terminalMembers)
    .where(
      and(
        eq(terminalMembers.terminalId, terminalId),
        eq(terminalMembers.userId, userId),
      ),
    )
    .limit(1);
  return !!m;
}

// GET /api/terminal-members?terminalId=... — owner + invited members. Any
// participant (owner or member) may read.
export async function GET(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const terminalId = new URL(request.url).searchParams.get("terminalId");
  if (!terminalId) {
    return NextResponse.json({ error: "terminalId required" }, { status: 400 });
  }
  const t = await loadTerminal(terminalId);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const amOwner = t.ownerId === me.id;
  if (!amOwner && !(await isTerminalMember(terminalId, me.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [owner] = await db
    .select({ userId: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, t.ownerId))
    .limit(1);

  const members = await db
    .select({ userId: users.id, displayName: users.displayName })
    .from(terminalMembers)
    .innerJoin(users, eq(users.id, terminalMembers.userId))
    .where(eq(terminalMembers.terminalId, terminalId));

  return NextResponse.json({
    terminalId,
    name: t.name,
    ownerId: t.ownerId,
    amOwner,
    owner: owner ? { ...owner, role: "owner" } : null,
    members: members.map((m) => ({ ...m, role: "member" })),
  });
}

// POST /api/terminal-members { terminalId, userId } — owner invites a user.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { terminalId, userId } = await request.json();
  if (!terminalId || !userId) {
    return NextResponse.json(
      { error: "terminalId and userId required" },
      { status: 400 },
    );
  }
  const t = await loadTerminal(terminalId);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.ownerId !== me.id) {
    return NextResponse.json({ error: "owner only" }, { status: 403 });
  }
  if (!(await isContact(me.id, userId))) {
    return NextResponse.json(
      { error: "You can only invite your contacts" },
      { status: 403 },
    );
  }
  if (userId === t.ownerId || (await isTerminalMember(terminalId, userId))) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  await db.insert(terminalMembers).values({ terminalId, userId, role: "member" });
  return NextResponse.json({ ok: true });
}

// DELETE /api/terminal-members { terminalId, userId } — owner removes a member,
// or a member removes themselves (leave).
export async function DELETE(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { terminalId, userId } = await request.json();
  if (!terminalId || !userId) {
    return NextResponse.json(
      { error: "terminalId and userId required" },
      { status: 400 },
    );
  }
  const t = await loadTerminal(terminalId);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (userId !== me.id && t.ownerId !== me.id) {
    return NextResponse.json({ error: "owner only" }, { status: 403 });
  }

  await db
    .delete(terminalMembers)
    .where(
      and(
        eq(terminalMembers.terminalId, terminalId),
        eq(terminalMembers.userId, userId),
      ),
    );
  return NextResponse.json({ ok: true });
}
