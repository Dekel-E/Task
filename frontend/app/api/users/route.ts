import { ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// All other users — used to start a DM or pick group members.
export async function GET() {
  const me = await getUser();
  if (!me) return unauthorized();

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      lastSeen: users.lastSeen,
    })
    .from(users)
    .where(ne(users.id, me.id))
    .orderBy(users.displayName);

  return NextResponse.json(rows);
}
