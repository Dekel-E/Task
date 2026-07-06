import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// GET /api/contacts — the caller's contact list (id, name, status, presence).
export async function GET() {
  const me = await getUser();
  if (!me) return unauthorized();

  const mine = await db
    .select({ contactId: contacts.contactId })
    .from(contacts)
    .where(eq(contacts.ownerId, me.id));
  const ids = mine.map((c) => c.contactId);
  if (ids.length === 0) return NextResponse.json([]);

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      statusText: users.statusText,
      lastSeen: users.lastSeen,
    })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(users.displayName);

  return NextResponse.json(rows);
}

// POST /api/contacts { email } — add a user to the caller's contacts by email.
// Email lives in auth.users (not the public profile), so look it up there.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { email, contactId } = await request.json();

  // Add either by explicit user id (e.g. from a group member row) or by email.
  let target: { id: string } | undefined;
  if (typeof contactId === "string" && contactId) {
    target = { id: contactId };
  } else if (typeof email === "string" && email.trim()) {
    const found = await db.execute(
      sql`select id from auth.users where lower(email) = lower(${email.trim()}) limit 1`,
    );
    target = (found as unknown as { id: string }[])[0];
  } else {
    return NextResponse.json(
      { error: "email or contactId required" },
      { status: 400 },
    );
  }

  if (!target) {
    return NextResponse.json(
      { error: "No user with that email" },
      { status: 404 },
    );
  }
  if (target.id === me.id) {
    return NextResponse.json(
      { error: "You can't add yourself" },
      { status: 400 },
    );
  }

  await db
    .insert(contacts)
    .values({ ownerId: me.id, contactId: target.id })
    .onConflictDoNothing();

  const [profile] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      statusText: users.statusText,
    })
    .from(users)
    .where(eq(users.id, target.id))
    .limit(1);

  return NextResponse.json({ ok: true, contact: profile });
}

// DELETE /api/contacts { contactId } — remove a contact.
export async function DELETE(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const { contactId } = await request.json();
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  await db
    .delete(contacts)
    .where(
      and(eq(contacts.ownerId, me.id), eq(contacts.contactId, contactId)),
    );
  return NextResponse.json({ ok: true });
}
