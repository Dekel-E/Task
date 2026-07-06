import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ChatsLayout } from "@/components/chats-layout";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getUser();
  if (!me) redirect("/login");
  const [profile] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);

  return (
    <ChatsLayout meId={me.id} meName={profile?.displayName ?? me.email ?? "Me"}>
      {children}
    </ChatsLayout>
  );
}
