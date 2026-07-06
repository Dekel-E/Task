"use client";

import { useEffect, useState } from "react";

const ONLINE_WINDOW_MS = 60_000; // "online" if seen within the last minute

function label(lastSeen: string | null): string {
  if (!lastSeen) return "offline";
  const seen = new Date(lastSeen).getTime();
  if (Date.now() - seen < ONLINE_WINDOW_MS) return "online";
  const d = new Date(lastSeen);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? `last seen ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : `last seen ${d.toLocaleDateString()}`;
}

// Polls a user's last_seen and renders online / last-seen. Used in DM headers.
export function PresenceBadge({ userId }: { userId: string }) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(`/api/presence?userId=${userId}`)
        .then((r) => r.json())
        .then((d) => {
          if (active) setLastSeen(d.lastSeen ?? null);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [userId]);

  const text = label(lastSeen);
  const online = text === "online";
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={`inline-block size-2 rounded-full ${
          online ? "bg-emerald-500" : "bg-zinc-400"
        }`}
      />
      {text}
    </span>
  );
}
