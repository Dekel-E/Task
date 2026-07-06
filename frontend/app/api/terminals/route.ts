import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { terminalMembers, terminals } from "@/lib/db/schema";

// GET /api/terminals — terminals the caller owns or was invited to.
export async function GET() {
  const me = await getUser();
  if (!me) return unauthorized();

  const rows = await db
    .selectDistinct({
      id: terminals.id,
      name: terminals.name,
      ownerId: terminals.ownerId,
      status: terminals.status,
      createdAt: terminals.createdAt,
    })
    .from(terminals)
    .leftJoin(terminalMembers, eq(terminalMembers.terminalId, terminals.id))
    .where(or(eq(terminals.ownerId, me.id), eq(terminalMembers.userId, me.id)));

  return NextResponse.json(
    rows.map((t) => ({ ...t, owned: t.ownerId === me.id })),
  );
}

// POST /api/terminals { name } — create a terminal owned by the caller.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { name } = await request.json();
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const [row] = await db
    .insert(terminals)
    .values({ ownerId: me.id, name: name.trim() })
    .returning({ id: terminals.id });

  return NextResponse.json({ id: row.id });
}

// Owner-only helper.
async function requireOwner(terminalId: string, userId: string) {
  const [t] = await db
    .select({ ownerId: terminals.ownerId })
    .from(terminals)
    .where(eq(terminals.id, terminalId))
    .limit(1);
  if (!t) return "not-found";
  return t.ownerId === userId ? "ok" : "not-owner";
}

// PATCH /api/terminals { terminalId, name } — owner renames the terminal.
export async function PATCH(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { terminalId, name } = await request.json();
  if (!terminalId || !name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "terminalId and name required" },
      { status: 400 },
    );
  }
  const check = await requireOwner(terminalId, me.id);
  if (check !== "ok") {
    return NextResponse.json(
      { error: check === "not-found" ? "Not found" : "owner only" },
      { status: check === "not-found" ? 404 : 403 },
    );
  }

  await db
    .update(terminals)
    .set({ name: name.trim().slice(0, 80) })
    .where(eq(terminals.id, terminalId));
  return NextResponse.json({ ok: true });
}

// DELETE /api/terminals { terminalId } — owner deletes the terminal (cascades
// members). Any live shared session is torn down when its sockets drop.
export async function DELETE(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { terminalId } = await request.json();
  if (!terminalId) {
    return NextResponse.json({ error: "terminalId required" }, { status: 400 });
  }
  const check = await requireOwner(terminalId, me.id);
  if (check !== "ok") {
    return NextResponse.json(
      { error: check === "not-found" ? "Not found" : "owner only" },
      { status: check === "not-found" ? 404 : 403 },
    );
  }

  await db.delete(terminals).where(eq(terminals.id, terminalId));
  return NextResponse.json({ ok: true });
}
