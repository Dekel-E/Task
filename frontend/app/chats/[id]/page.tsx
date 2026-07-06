import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { ChatHeaderMenu } from "@/components/chat-header-menu";
import { ChatView } from "@/components/chat-view";
import { PresenceBadge } from "@/components/presence-badge";
import { getUser } from "@/lib/auth";
import { isMember } from "@/lib/chat";
import { db } from "@/lib/db";
import {
  conversation,
  conversationMembers,
  groups,
  users,
} from "@/lib/db/schema";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getUser();
  if (!me) redirect("/login");
  if (!(await isMember(id, me.id))) notFound();

  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, id))
    .limit(1);
  if (!conv) notFound();

  const isGroup = conv.type === "group";
  let title = "Chat";
  let otherUserId: string | null = null;
  let subtitle: string | null = null;

  // All members with names — used for the title/subtitle AND passed to ChatView
  // so it can label the typing indicator and group senders by conversation
  // membership (not by the viewer's contact list, which may not include them).
  const memberRows = await db
    .select({ id: users.id, name: users.displayName })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, id));
  const memberNames: Record<string, string> = {};
  for (const m of memberRows) memberNames[m.id] = m.name;

  if (isGroup) {
    const [g] = await db
      .select()
      .from(groups)
      .where(eq(groups.conversationId, id))
      .limit(1);
    title = g?.name ?? "Group";
    subtitle = memberRows.map((m) => m.name).join(", ");
  } else {
    const other = memberRows.find((m) => m.id !== me.id);
    title = other?.name ?? "Chat";
    otherUserId = other?.id ?? null;
  }

  const identity = (
    <>
      <Avatar name={title} seed={otherUserId ?? id} size={40} group={isGroup} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-wa-ink">{title}</div>
        {isGroup ? (
          <div className="truncate text-xs text-wa-subtle">{subtitle}</div>
        ) : (
          otherUserId && <PresenceBadge userId={otherUserId} />
        )}
      </div>
    </>
  );

  const header = (
    <div className="flex h-16 shrink-0 items-center gap-3 bg-wa-panel px-4">
      <Link href="/chats" className="text-wa-subtle md:hidden" aria-label="Back">
        <ArrowLeft size={22} />
      </Link>
      {isGroup ? (
        // Clicking the group's name/avatar opens the group info window.
        <Link
          href={`/chats/${id}/info`}
          className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
          title="Group info"
        >
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>
      )}
      <ChatHeaderMenu conversationId={id} />
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {header}
      <ChatView
        conversationId={id}
        meId={me.id}
        isGroup={isGroup}
        memberNames={memberNames}
      />
    </div>
  );
}
