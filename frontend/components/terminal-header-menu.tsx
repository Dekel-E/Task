"use client";

import { LogOut, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// CRUD menu in the terminal header: owner can rename/delete, a member can leave.
export function TerminalHeaderMenu({
  terminalId,
  meId,
  isOwner,
  name,
}: {
  terminalId: string;
  meId: string;
  isOwner: boolean;
  name: string;
}) {
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

  async function rename() {
    setOpen(false);
    const next = prompt("Rename terminal", name);
    if (!next || next.trim() === "" || next.trim() === name) return;
    await fetch("/api/terminals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId, name: next.trim() }),
    });
    router.refresh();
  }
  async function del() {
    setOpen(false);
    if (!confirm(`Delete terminal "${name}"? This ends any shared session.`)) return;
    await fetch("/api/terminals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId }),
    });
    router.push("/terminals");
    router.refresh();
  }
  async function leave() {
    setOpen(false);
    if (!confirm(`Leave "${name}"?`)) return;
    await fetch("/api/terminal-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId, userId: meId }),
    });
    router.push("/terminals");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-full text-wa-subtle hover:bg-wa-hover"
        title="Options"
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-md border border-wa-line bg-white py-1 shadow-lg">
          {isOwner ? (
            <>
              <button
                onClick={rename}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-wa-hover"
              >
                <Pencil size={16} /> Rename
              </button>
              <button
                onClick={del}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-wa-hover"
              >
                <Trash2 size={16} /> Delete terminal
              </button>
            </>
          ) : (
            <button
              onClick={leave}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-wa-hover"
            >
              <LogOut size={16} /> Leave terminal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
