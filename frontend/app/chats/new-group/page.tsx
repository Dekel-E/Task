"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";

type Contact = { id: string; displayName: string };

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((u) => setContacts(Array.isArray(u) ? u : []));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim() === "") return setError("Group name is required");
    setSubmitting(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), memberIds: [...selected] }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to create group");
      setSubmitting(false);
      return;
    }
    const { id } = await res.json();
    router.push(`/chats/${id}`);
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      <div className="flex h-16 shrink-0 items-center gap-4 bg-wa-teal px-4 text-white">
        <Link href="/chats" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <span className="font-medium">New group</span>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="bg-white px-6 py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="w-full border-b-2 border-wa-green bg-transparent pb-1 outline-none"
          />
        </div>

        <div className="px-6 py-2 text-xs font-medium text-wa-subtle">
          Add members (contacts only)
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {contacts.length === 0 && (
            <p className="p-6 text-sm text-wa-subtle">
              No contacts yet. Add contacts from the chats screen first.
            </p>
          )}
          {contacts.map((u) => {
            const on = selected.has(u.id);
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-3 px-6 py-2 text-left hover:bg-wa-hover"
              >
                <Avatar name={u.displayName} seed={u.id} size={40} />
                <span className="flex-1 text-sm text-wa-ink">
                  {u.displayName}
                </span>
                {on && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-wa-green text-white">
                    <Check size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}
        <div className="bg-wa-panel p-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-wa-green py-2.5 font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create group"}
          </button>
        </div>
      </form>
    </div>
  );
}
