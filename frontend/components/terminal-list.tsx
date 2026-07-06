"use client";

import { LogOut, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TerminalItem = { id: string; name: string; owned: boolean };

function RowMenu({
  item,
  onRename,
  onDelete,
  onLeave,
}: {
  item: TerminalItem;
  onRename: () => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    fn();
  };
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex size-8 items-center justify-center rounded-full text-wa-subtle hover:bg-wa-hover"
        title="Options"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-md border border-wa-line bg-white py-1 shadow-lg">
          {item.owned ? (
            <>
              <button
                onClick={act(onRename)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-wa-hover"
              >
                <Pencil size={15} /> Rename
              </button>
              <button
                onClick={act(onDelete)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-wa-hover"
              >
                <Trash2 size={15} /> Delete
              </button>
            </>
          ) : (
            <button
              onClick={act(onLeave)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-wa-hover"
            >
              <LogOut size={15} /> Leave
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TerminalList({ meId }: { meId: string }) {
  const [items, setItems] = useState<TerminalItem[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const j = await fetch("/api/terminals").then((r) => r.json());
    setItems(Array.isArray(j) ? j : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === "") return;
    setCreating(true);
    const res = await fetch("/api/terminals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setName("");
      await load();
    }
    setCreating(false);
  }

  async function rename(item: TerminalItem) {
    const next = prompt("Rename terminal", item.name);
    if (!next || next.trim() === "" || next.trim() === item.name) return;
    await fetch("/api/terminals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId: item.id, name: next.trim() }),
    });
    load();
  }
  async function remove(item: TerminalItem) {
    if (!confirm(`Delete terminal "${item.name}"? This ends any shared session.`))
      return;
    await fetch("/api/terminals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId: item.id }),
    });
    load();
  }
  async function leave(item: TerminalItem) {
    if (!confirm(`Leave "${item.name}"?`)) return;
    await fetch("/api/terminal-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId: item.id, userId: meId }),
    });
    load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
      <h1 className="mb-4 text-lg font-semibold text-wa-ink">Terminals</h1>

      <form onSubmit={create} className="mb-6 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New terminal name (e.g. deploy-shell)"
        />
        <Button type="submit" disabled={creating}>
          Create
        </Button>
      </form>

      {loading && <p className="text-sm text-wa-subtle">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-wa-subtle">
          No terminals yet. Create one to open a shared PowerShell.
        </p>
      )}

      <div className="grid gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-md border border-wa-line hover:bg-wa-hover"
          >
            <Link
              href={`/terminals/${t.id}`}
              className="flex flex-1 items-center justify-between px-3 py-3"
            >
              <span className="flex items-center gap-2 font-medium text-wa-ink">
                <span className="text-wa-subtle">$</span>
                {t.name}
              </span>
              <span className="text-xs text-wa-subtle">
                {t.owned ? "owner" : "shared with you"}
              </span>
            </Link>
            <div className="pr-2">
              <RowMenu
                item={t}
                onRename={() => rename(t)}
                onDelete={() => remove(t)}
                onLeave={() => leave(t)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
