import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";

// True if `contactId` is on `ownerId`'s contact list. Used to enforce that a
// user may only DM / add-to-group people they've added.
export async function isContact(ownerId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.ownerId, ownerId), eq(contacts.contactId, contactId)),
    )
    .limit(1);
  return !!row;
}
