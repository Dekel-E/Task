"use client";

import { usePathname } from "next/navigation";

import { ConversationSidebar } from "@/components/conversation-sidebar";
import { NavRail } from "@/components/nav-rail";

// WhatsApp Web frame: icon rail + conversation sidebar + main pane. On mobile
// only one of sidebar/main shows (sidebar at /chats, main once a chat is open).
export function ChatsLayout({
  meId,
  meName,
  children,
}: {
  meId: string;
  meName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasMain = pathname !== "/chats";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-wa-panel">
      <NavRail meName={meName} />
      <aside
        className={`h-full w-full shrink-0 border-r border-wa-line bg-white md:w-[380px] lg:w-[440px] ${
          hasMain ? "hidden md:block" : "block"
        }`}
      >
        <ConversationSidebar meId={meId} meName={meName} />
      </aside>
      <main className={`min-w-0 flex-1 ${hasMain ? "block" : "hidden md:block"}`}>
        {children}
      </main>
    </div>
  );
}
