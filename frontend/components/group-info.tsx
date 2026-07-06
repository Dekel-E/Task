"use client";

import { ArrowLeft, Check, LogOut, Pencil, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";

type Member = { userId: string; displayName: string; role: string };
type GroupInfoData = {
  conversationId: string;
  name: string;
  creatorName: string | null;
  createdAt: string;
  myRole: string;
  members: Member[];
};
type Contact = { id: string };

export function GroupInfo({
  conversationId,
  meId,
}: {
  conversationId: string;
  meId: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<GroupInfoData | null>(null);
  const [contactIds, setContactIds] = useState<Set<string>>(new Set());
  const [addable, setAddable] = useState<{ id: string; displayName: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const load = useCallback(async () => {
    const [g, contacts] = await Promise.all([
      fetch(`/api/groups?conversationId=${conversationId}`).then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]);
    setData(g && !g.error ? g : null);
    if (g?.name) setNameDraft(g.name);
    const cIds: Contact[] = Array.isArray(contacts) ? contacts : [];
    setContactIds(new Set(cIds.map((c) => c.id)));
    setAddable(Array.isArray(contacts) ? contacts.map((c: { id: string; displayName: string }) => c) : []);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-wa-panel text-sm text-wa-subtle">
        Loading…
      </div>
    );
  }

  const isAdmin = data.myRole === "admin";
  const memberIds = new Set(data.members.map((m) => m.userId));
  const invitable = addable.filter((u) => !memberIds.has(u.id));
  const created = new Date(data.createdAt);

  async function addMemberToGroup(userId: string) {
    await fetch("/api/group-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId }),
    });
    load();
  }
  async function removeMember(userId: string) {
    await fetch("/api/group-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, userId }),
    });
    if (userId === meId) router.push("/chats");
    else load();
  }
  async function addContact(userId: string) {
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: userId }),
    });
    load();
  }
  async function saveName() {
    if (nameDraft.trim() === "" || nameDraft.trim() === data!.name) {
      setEditingName(false);
      return;
    }
    await fetch("/api/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, name: nameDraft.trim() }),
    });
    setEditingName(false);
    load();
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      <div className="flex h-16 shrink-0 items-center gap-4 bg-wa-teal px-4 text-white">
        <Link href={`/chats/${conversationId}`} aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <span className="font-medium">Group info</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* header: avatar, name (editable by admin), meta */}
        <div className="flex flex-col items-center bg-white py-8">
          <Avatar name={data.name} size={96} group />
          {editingName ? (
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="border-b-2 border-wa-green bg-transparent pb-1 text-center text-xl outline-none"
              />
              <button type="submit" className="text-wa-green-dark" title="Save">
                <Check size={20} />
              </button>
            </form>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-xl text-wa-ink">{data.name}</h1>
              {isAdmin && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-wa-subtle hover:text-wa-ink"
                  title="Edit name"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-wa-subtle">
            Group · {data.members.length} members
          </p>
          <p className="mt-1 text-xs text-wa-subtle">
            Created by {data.creatorName ?? "someone"} ·{" "}
            {created.toLocaleDateString([], {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}{" "}
            at {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* members */}
        <div className="mt-3 bg-white">
          <div className="flex items-center justify-between px-6 py-2 text-xs font-medium text-wa-green-dark">
            {data.members.length} members
            {isAdmin && invitable.length > 0 && (
              <button
                onClick={() => setAdding((a) => !a)}
                className="flex items-center gap-1"
              >
                {adding ? <X size={16} /> : <UserPlus size={16} />}
                {adding ? "Done" : "Add member"}
              </button>
            )}
          </div>

          {adding
            ? invitable.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMemberToGroup(u.id)}
                  className="flex w-full items-center gap-3 px-6 py-2 text-left hover:bg-wa-hover"
                >
                  <Avatar name={u.displayName} seed={u.id} size={40} />
                  <span className="flex-1 text-sm text-wa-ink">{u.displayName}</span>
                  <UserPlus size={16} className="text-wa-green-dark" />
                </button>
              ))
            : data.members.map((m) => {
                const isMe = m.userId === meId;
                const alreadyContact = contactIds.has(m.userId);
                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 px-6 py-2 hover:bg-wa-hover"
                  >
                    <Avatar name={m.displayName} seed={m.userId} size={40} />
                    <span className="flex-1 text-sm text-wa-ink">
                      {m.displayName}
                      {isMe && <span className="text-wa-subtle"> (you)</span>}
                    </span>
                    {m.role === "admin" && (
                      <span className="rounded bg-wa-green/10 px-1.5 py-0.5 text-xs text-wa-green-dark">
                        admin
                      </span>
                    )}
                    {!isMe && !alreadyContact && (
                      <button
                        onClick={() => addContact(m.userId)}
                        className="flex items-center gap-1 text-xs text-wa-green-dark hover:underline"
                        title="Add to contacts"
                      >
                        <UserPlus size={14} /> Add
                      </button>
                    )}
                    {isAdmin && !isMe && (
                      <button
                        onClick={() => removeMember(m.userId)}
                        className="text-wa-subtle hover:text-red-600"
                        title="Remove from group"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
        </div>

        {/* leave */}
        <div className="mt-3 mb-6 bg-white">
          <button
            onClick={() => removeMember(meId)}
            className="flex w-full items-center gap-3 px-6 py-3 text-left text-red-600 hover:bg-wa-hover"
          >
            <LogOut size={20} />
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
}
