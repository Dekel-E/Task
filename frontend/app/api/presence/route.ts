import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// POST /api/presence — heartbeat: mark the caller online now.
export async function POST() {
  const me = await getUser();
  if (!me) return unauthorized();
  await db
    .update(users)
    .set({ lastSeen: sql`now()` })
    .where(eq(users.id, me.id));
  return NextResponse.json({ ok: true });
}

// GET /api/presence?userId=... — that user's last_seen (for online/last-seen UI).
export async function GET(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const [row] = await db
    .select({ lastSeen: users.lastSeen })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return NextResponse.json({ lastSeen: row?.lastSeen ?? null });
}
