import { and, eq, or } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TerminalHeaderMenu } from "@/components/terminal-header-menu";
import { TerminalMembers } from "@/components/terminal-members";
import { TerminalView } from "@/components/terminal-view";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { terminalMembers, terminals } from "@/lib/db/schema";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getUser();
  if (!me) redirect("/login");

  const [access] = await db
    .selectDistinct({
      id: terminals.id,
      name: terminals.name,
      ownerId: terminals.ownerId,
    })
    .from(terminals)
    .leftJoin(terminalMembers, eq(terminalMembers.terminalId, terminals.id))
    .where(
      and(
        eq(terminals.id, id),
        or(eq(terminals.ownerId, me.id), eq(terminalMembers.userId, me.id)),
      ),
    )
    .limit(1);

  if (!access) notFound();
  const isOwner = access.ownerId === me.id;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 bg-wa-panel px-4">
        <Link
          href="/terminals"
          className="text-wa-subtle hover:text-wa-ink"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <span className="font-medium text-wa-ink">{access.name}</span>
          <span className="rounded bg-wa-green/10 px-1.5 py-0.5 text-xs text-wa-green-dark">
            shared PowerShell
          </span>
        </div>
        <TerminalHeaderMenu
          terminalId={id}
          meId={me.id}
          isOwner={isOwner}
          name={access.name}
        />
      </div>
      <TerminalMembers terminalId={id} meId={me.id} />
      <TerminalView terminalId={id} />
    </div>
  );
}
