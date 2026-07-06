"use client";

import { CheckCheck, Paperclip, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  body: string | null;
  createdAt: string;
};
type Attachment = {
  messageId: string;
  kind: string;
  fileName: string;
  mimeType: string;
  url: string | null;
};

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatView({
  conversationId,
  meId,
  isGroup,
  memberNames = {},
}: {
  conversationId: string;
  meId: string;
  isGroup: boolean;
  // id -> display name for every member of this conversation (from the server).
  // Seeds the name map so the typing indicator and group senders resolve even
  // when the other person isn't in the viewer's contacts.
  memberNames?: Record<string, string>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment>>({});
  const [names, setNames] = useState<Record<string, string>>(memberNames);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTsRef = useRef<string | null>(null);

  const mergeAttachments = useCallback((list: Attachment[]) => {
    setAttachments((prev) => {
      const next = { ...prev };
      for (const a of list) next[a.messageId] = a;
      return next;
    });
  }, []);

  useEffect(() => {
    fetch(`/api/messages?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((rows: Message[]) => setMessages(Array.isArray(rows) ? rows : []));
    fetch(`/api/attachments?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((rows: Attachment[]) => {
        if (Array.isArray(rows)) mergeAttachments(rows);
      });
  }, [conversationId, mergeAttachments]);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]).then(([me, contacts]) => {
      setNames((prev) => {
        const map = { ...prev };
        if (me?.id) map[me.id] = me.displayName;
        if (Array.isArray(contacts))
          for (const u of contacts) map[u.id] = u.displayName;
        return map;
      });
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, attachments]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Realtime enforces RLS, so the socket must carry the user's JWT —
      // otherwise is_member() sees no user and every message event is filtered
      // out (messages then only appear on a manual refresh).
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`conv:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
          // postgres_changes delivers snake_case columns; normalize to Message.
          const raw = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string | null;
            created_at: string;
          };
          const m: Message = {
            id: raw.id,
            conversationId: raw.conversation_id,
            senderId: raw.sender_id,
            body: raw.body,
            createdAt: raw.created_at,
          };
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
          fetch(`/api/attachments?messageId=${m.id}`)
            .then((r) => r.json())
            .then((rows: Attachment[]) => {
              if (Array.isArray(rows) && rows.length) mergeAttachments(rows);
            });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            last_typing_at: string | null;
          };
          if (row.user_id === meId || !row.last_typing_at) return;
          if (Date.now() - new Date(row.last_typing_at).getTime() > 6000) return;
          setTypingUser(row.user_id);
          if (typingClear.current) clearTimeout(typingClear.current);
          typingClear.current = setTimeout(() => setTypingUser(null), 4000);
        },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (typingClear.current) clearTimeout(typingClear.current);
    };
  }, [conversationId, meId, mergeAttachments]);

  // Track the newest message time so the fallback poll only fetches what's new.
  useEffect(() => {
    lastTsRef.current = messages.length
      ? messages[messages.length - 1].createdAt
      : null;
  }, [messages]);

  // Fallback poll: if the realtime socket is down (or slow), still pull new
  // messages every couple of seconds. Deduped by id, so it composes with
  // realtime — whichever delivers first wins, the other is a no-op.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      const after = lastTsRef.current;
      const url = `/api/messages?conversationId=${conversationId}${
        after ? `&after=${encodeURIComponent(after)}` : ""
      }`;
      try {
        const rows: Message[] = await fetch(url).then((r) => r.json());
        if (stop || !Array.isArray(rows) || rows.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = rows.filter((m) => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        // Pick up any attachments on the newly-arrived messages.
        fetch(`/api/attachments?conversationId=${conversationId}`)
          .then((r) => r.json())
          .then((a: Attachment[]) => {
            if (!stop && Array.isArray(a) && a.length) mergeAttachments(a);
          })
          .catch(() => {});
      } catch {
        // Network hiccup — try again on the next tick.
      }
    };
    const t = setInterval(poll, 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [conversationId, mergeAttachments]);

  const onChangeText = useCallback(
    (value: string) => {
      setText(value);
      const now = Date.now();
      if (now - lastTypingSent.current > 2500) {
        lastTypingSent.current = now;
        fetch("/api/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        }).catch(() => {});
      }
    },
    [conversationId],
  );

  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const body = text.trim();
      if (!body || sending) return;
      setSending(true);
      setText("");
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      if (res.ok) {
        const m: Message = await res.json();
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
      }
      setSending(false);
    },
    [text, sending, conversationId],
  );

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploading(true);
      const fd = new FormData();
      fd.append("conversationId", conversationId);
      fd.append("file", file);
      if (text.trim()) fd.append("body", text.trim());
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      if (res.ok) {
        const { message, attachment } = await res.json();
        setText("");
        setMessages((prev) =>
          prev.some((x) => x.id === message.id) ? prev : [...prev, message],
        );
        if (attachment) mergeAttachments([attachment]);
      } else {
        const { error } = await res
          .json()
          .catch(() => ({ error: "upload failed" }));
        alert(error ?? "upload failed");
      }
      setUploading(false);
    },
    [conversationId, text, mergeAttachments],
  );

  return (
    <div className="flex h-full flex-col">
      {typingUser && (
        <div className="absolute z-10 px-4 pt-1 text-xs text-wa-green-dark">
          {names[typingUser] ?? "Someone"} is typing…
        </div>
      )}

      <div className="wa-chat-bg min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-6 py-4">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const sender = m.senderName ?? names[m.senderId] ?? "Unknown";
            const att = attachments[m.id];
            const prev = messages[i - 1];
            const grouped = prev && prev.senderId === m.senderId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} ${
                  grouped ? "mt-0.5" : "mt-2"
                }`}
              >
                <div
                  className={`relative max-w-[65%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm ${
                    mine ? "bg-wa-bubble-out" : "bg-wa-bubble-in"
                  } ${
                    !grouped
                      ? mine
                        ? "wa-tail-out rounded-tr-none"
                        : "wa-tail-in rounded-tl-none"
                      : ""
                  }`}
                >
                  {isGroup && !mine && !grouped && (
                    <div className="mb-0.5 text-xs font-semibold text-wa-green-dark">
                      {sender}
                    </div>
                  )}
                  {att?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.url}
                      alt={att.fileName}
                      onClick={() => setLightbox(att.url)}
                      className="mb-1 max-h-72 cursor-pointer rounded-md transition-opacity hover:opacity-90"
                    />
                  )}
                  {m.body && (
                    <span className="whitespace-pre-wrap break-words text-wa-ink">
                      {m.body}
                    </span>
                  )}
                  <span className="float-right ml-2 mt-1 flex items-center gap-1 text-[10px] text-wa-subtle">
                    {clock(m.createdAt)}
                    {mine && <CheckCheck size={14} className="text-wa-tick" />}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={send}
        className="flex shrink-0 items-center gap-2 bg-wa-panel px-4 py-2.5"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Attach image"
          className="text-wa-subtle hover:text-wa-ink"
        >
          <Paperclip size={22} className={uploading ? "animate-pulse" : ""} />
        </button>
        <input
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={uploading ? "Uploading image…" : "Type a message"}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg bg-white px-4 py-2 text-sm outline-none placeholder:text-wa-subtle"
        />
        <button
          type="submit"
          disabled={sending || text.trim() === ""}
          className="flex size-10 items-center justify-center rounded-full bg-wa-green text-white transition-opacity disabled:opacity-40"
          title="Send"
        >
          <Send size={18} />
        </button>
      </form>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <button
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            title="Close"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      )}
    </div>
  );
}
