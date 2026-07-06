"use client";

import { MessageCircle, TerminalSquare, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { createClient } from "@/lib/supabase/client";

// WhatsApp Web's slim left icon rail: switch between Chats and Terminals, and
// sign out. Also hosts the presence heartbeat so it runs on every app page.
export function NavRail({ meName }: { meName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const item = (href: string, active: boolean, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      title={label}
      className={`flex size-10 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-wa-green/15 text-wa-green-dark"
          : "text-wa-subtle hover:bg-wa-hover"
      }`}
    >
      {icon}
    </Link>
  );

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center justify-between border-r border-wa-line bg-wa-panel py-3">
      <PresenceHeartbeat />
      <div className="flex flex-col items-center gap-2">
        {item("/chats", pathname.startsWith("/chats"), "Chats", <MessageCircle size={22} />)}
        {item(
          "/terminals",
          pathname.startsWith("/terminals"),
          "Terminals",
          <TerminalSquare size={22} />,
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          title="Log out"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="flex size-10 items-center justify-center rounded-full text-wa-subtle hover:bg-wa-hover"
        >
          <LogOut size={20} />
        </button>
        <Avatar name={meName} size={36} />
      </div>
    </nav>
  );
}
