"use client";

import { MessageSquarePlus, Search, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  type: "dm" | "group";
  title: string;
  otherUserId: string | null;
  lastMessage: { body: string | null; createdAt: string; senderId: string } | null;
};
type Contact = { id: string; displayName: string; statusText?: string };

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ConversationSidebar({
  meId,
  meName,
}: {
  meId: string;
  meName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closePicker = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setPicking(false);
    setAddMsg(null);
    setAddEmail("");
  }, []);

  // Clear any pending auto-close timer on unmount.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const loadConvs = useCallback(async () => {
    const c = await fetch("/api/conversations").then((r) => r.json());
    setConvs(Array.isArray(c) ? c : []);
  }, []);
  const loadContacts = useCallback(async () => {
    const c = await fetch("/api/contacts").then((r) => r.json());
    setContacts(Array.isArray(c) ? c : []);
  }, []);

  useEffect(() => {
    loadConvs();
    loadContacts();
  }, [loadConvs, loadContacts]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Authenticate the realtime socket (RLS needs the user's JWT), else no
      // message events arrive and the list never updates live.
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;
      channel = supabase
        .channel("conversation-list")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => loadConvs(),
        )
        .subscribe();
    })();

    // Fallback so the list still refreshes if realtime is unavailable.
    const t = setInterval(loadConvs, 4000);
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [loadConvs]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddMsg(data.error ?? "Could not add contact");
      return;
    }
    setAddEmail("");
    setAddMsg(`Added ${data.contact?.displayName ?? "contact"}`);
    loadContacts();
    // Auto-close the panel shortly after a successful add (leaving the "Added …"
    // confirmation visible briefly).
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(closePicker, 1200);
  }

  async function openDm(userId: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    const { id } = await res.json();
    setPicking(false);
    router.push(`/chats/${id}`);
  }

  const filtered = convs.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between bg-wa-panel px-4">
        <Link href="/profile" className="flex items-center gap-3" title="Profile">
          <Avatar name={meName} size={40} />
          <span className="text-sm font-medium text-wa-ink">{meName}</span>
        </Link>
        <div className="flex items-center gap-1 text-wa-subtle">
          <Link
            href="/chats/new-group"
            title="New group"
            className="flex size-9 items-center justify-center rounded-full hover:bg-wa-hover"
          >
            <Users size={20} />
          </Link>
          <button
            title="New chat"
            onClick={() => setPicking((p) => !p)}
            className="flex size-9 items-center justify-center rounded-full hover:bg-wa-hover"
          >
            <MessageSquarePlus size={20} />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-wa-line px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-wa-panel px-3 py-1.5">
          <Search size={16} className="text-wa-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-wa-subtle"
          />
        </div>
      </div>

      {picking && (
        <div className="shrink-0 border-b border-wa-line bg-white">
          <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-wa-subtle">
            New chat
            <button onClick={closePicker}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={addContact} className="flex gap-2 px-4 pb-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-wa-panel px-3 py-1.5">
              <UserPlus size={16} className="text-wa-subtle" />
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Add contact by email"
                className="w-full bg-transparent text-sm outline-none placeholder:text-wa-subtle"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-wa-green px-3 text-sm font-medium text-white"
            >
              Add
            </button>
          </form>
          {addMsg && (
            <p className="px-4 pb-1 text-xs text-wa-subtle">{addMsg}</p>
          )}
          <div className="max-h-64 overflow-y-auto pb-1">
            {contacts.length === 0 && (
              <p className="px-4 py-3 text-sm text-wa-subtle">
                No contacts yet — add one by email above.
              </p>
            )}
            {contacts.map((u) => (
              <button
                key={u.id}
                onClick={() => openDm(u.id)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-wa-hover"
              >
                <Avatar name={u.displayName} seed={u.id} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-wa-ink">
                    {u.displayName}
                  </div>
                  {u.statusText && (
                    <div className="truncate text-xs text-wa-subtle">
                      {u.statusText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-wa-subtle">
            No conversations. Tap the pencil to add a contact and start chatting.
          </p>
        )}
        {filtered.map((c) => {
          const active = pathname === `/chats/${c.id}`;
          const preview = c.lastMessage
            ? (c.lastMessage.body ?? "📷 Photo")
            : "Tap to chat";
          return (
            <Link
              key={c.id}
              href={`/chats/${c.id}`}
              className={`flex items-center gap-3 px-3 py-3 ${
                active ? "bg-wa-active" : "hover:bg-wa-hover"
              }`}
            >
              <Avatar
                name={c.title}
                seed={c.otherUserId ?? c.id}
                size={48}
                group={c.type === "group"}
              />
              <div className="min-w-0 flex-1 border-b border-wa-line pb-3">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-wa-ink">
                    {c.title}
                  </span>
                  {c.lastMessage && (
                    <span className="ml-2 shrink-0 text-xs text-wa-subtle">
                      {timeLabel(c.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-wa-subtle">{preview}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
