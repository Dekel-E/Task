"use client";

import { ArrowLeft, Check, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";

type Profile = { id: string; displayName: string; statusText: string };

function Field({
  label,
  value,
  hint,
  onSave,
}: {
  label: string;
  value: string;
  hint: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="bg-white px-6 py-4">
      <div className="text-xs font-medium text-wa-green-dark">{label}</div>
      {editing ? (
        <form
          className="mt-1 flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(draft);
            setEditing(false);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 border-b-2 border-wa-green bg-transparent pb-1 text-sm outline-none"
          />
          <button type="submit" className="text-wa-green-dark" title="Save">
            <Check size={20} />
          </button>
        </form>
      ) : (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-wa-ink">{value}</span>
          <button
            onClick={() => setEditing(true)}
            className="text-wa-subtle hover:text-wa-ink"
            title="Edit"
          >
            <Pencil size={16} />
          </button>
        </div>
      )}
      <div className="mt-1 text-xs text-wa-subtle">{hint}</div>
    </div>
  );
}

export function ProfileEditor() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setProfile);
  }, []);

  async function patch(update: Partial<Profile>) {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) {
      setProfile(await res.json());
      // The sidebar name, chat titles, etc. are rendered by server components;
      // revalidate them so the new name shows everywhere without a hard reload.
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-wa-panel">
      <div className="flex h-28 items-end gap-4 bg-wa-teal px-6 pb-4 text-white">
        <Link href="/chats" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <span className="text-lg font-medium">Profile</span>
      </div>

      <div className="mx-auto max-w-xl">
        <div className="flex justify-center bg-wa-panel py-8">
          <Avatar name={profile?.displayName ?? "?"} size={120} />
        </div>

        {profile && (
          <div className="divide-y divide-wa-line">
            <Field
              label="Your name"
              value={profile.displayName}
              hint="This name is visible to your contacts."
              onSave={(v) => patch({ displayName: v })}
            />
            <Field
              label="Status"
              value={profile.statusText}
              hint="A short line about you (like WhatsApp's About)."
              onSave={(v) => patch({ statusText: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
