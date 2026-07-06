"use client";

import { MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Overflow menu in the chat header — currently just "Delete chat".
export function ChatHeaderMenu({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function del() {
    setOpen(false);
    if (
      !confirm(
        "Delete this chat for you? It clears your copy of the history and hides it from your list. The other person keeps their chat, and a new message will bring it back.",
      )
    )
      return;
    await fetch("/api/conversations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    router.push("/chats");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-full text-wa-subtle hover:bg-wa-hover"
        title="Menu"
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-md border border-wa-line bg-white py-1 shadow-lg">
          <button
            onClick={del}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-wa-hover"
          >
            <Trash2 size={16} /> Delete chat
          </button>
        </div>
      )}
    </div>
  );
}
