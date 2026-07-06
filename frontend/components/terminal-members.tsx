"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Participant = { userId: string; displayName: string; role: string };
type Info = {
  amOwner: boolean;
  owner: Participant | null;
  members: Participant[];
};
type User = { id: string; displayName: string };

// Compact "shared with" bar for a terminal, with owner-only invite/remove.
export function TerminalMembers({
  terminalId,
  meId,
}: {
  terminalId: string;
  meId: string;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [g, u] = await Promise.all([
      fetch(`/api/terminal-members?terminalId=${terminalId}`).then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]);
    setInfo(g && !g.error ? g : null);
    setUsers(
      Array.isArray(u)
        ? u.map((c: { id: string; displayName: string }) => ({
            id: c.id,
            displayName: c.displayName,
          }))
        : [],
    );
  }, [terminalId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!info) return null;

  const participants = [info.owner, ...info.members].filter(
    Boolean,
  ) as Participant[];
  const memberIds = new Set(participants.map((p) => p.userId));
  const addable = users.filter((u) => !memberIds.has(u.id));

  async function invite(userId: string) {
    await fetch("/api/terminal-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId, userId }),
    });
    load();
  }

  async function remove(userId: string) {
    await fetch("/api/terminal-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId, userId }),
    });
    load();
  }

  return (
    <div className="border-b bg-muted/30 px-4 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          Shared with:{" "}
          <span className="text-foreground">
            {participants
              .map((p) => p.displayName + (p.role === "owner" ? " (owner)" : ""))
              .join(", ")}
          </span>
        </span>
        {info.amOwner && (
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Done" : "Invite"}
          </Button>
        )}
      </div>

      {info.amOwner && open && (
        <div className="mt-2 grid gap-1">
          {info.members.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {info.members.map((m) => (
                <span
                  key={m.userId}
                  className="flex items-center gap-1 rounded bg-background px-2 py-1 text-xs"
                >
                  {m.displayName}
                  <button
                    onClick={() => remove(m.userId)}
                    className="text-destructive hover:underline"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {addable.length === 0 ? (
            <p className="text-xs text-muted-foreground">No one else to invite.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {addable.map((u) => (
                <button
                  key={u.id}
                  onClick={() => invite(u.id)}
                  className="rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  + {u.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
