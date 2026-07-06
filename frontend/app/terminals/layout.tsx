import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { NavRail } from "@/components/nav-rail";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export default async function TerminalsLayout({
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
    <div className="flex h-screen w-full overflow-hidden bg-wa-panel">
      <NavRail meName={profile?.displayName ?? me.email ?? "Me"} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
