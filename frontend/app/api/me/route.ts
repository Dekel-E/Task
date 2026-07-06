import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// GET /api/me — the signed-in user's editable profile.
export async function GET() {
  const me = await getUser();
  if (!me) return unauthorized();

  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      statusText: users.statusText,
      avatarPath: users.avatarPath,
    })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);

  return NextResponse.json(row ?? { id: me.id, displayName: me.email });
}

// PATCH /api/me { displayName?, statusText? } — edit own profile.
export async function PATCH(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { displayName, statusText } = await request.json();
  const update: { displayName?: string; statusText?: string } = {};
  if (typeof displayName === "string" && displayName.trim() !== "") {
    update.displayName = displayName.trim().slice(0, 60);
  }
  if (typeof statusText === "string") {
    update.statusText = statusText.trim().slice(0, 140);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, me.id))
    .returning({
      id: users.id,
      displayName: users.displayName,
      statusText: users.statusText,
    });

  return NextResponse.json(row);
}
