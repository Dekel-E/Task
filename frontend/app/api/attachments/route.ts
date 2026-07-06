import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getUser, unauthorized } from "@/lib/auth";
import { isMember } from "@/lib/chat";
import { db } from "@/lib/db";
import { attachments, messages } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "attachments";
const SIGNED_URL_TTL = 3600; // 1 hour
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Sign a batch of storage paths; returns a path -> URL map.
async function signPaths(paths: string[]) {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

// GET /api/attachments?conversationId=...  -> attachments for the whole thread
// GET /api/attachments?messageId=...       -> the attachment for one message
// Both membership-gated; each row carries a short-lived signed URL.
export async function GET(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const params = new URL(request.url).searchParams;
  const conversationId = params.get("conversationId");
  const messageId = params.get("messageId");

  let rows: (typeof attachments.$inferSelect)[] = [];
  if (conversationId) {
    if (!(await isMember(conversationId, me.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const msgIds = (
      await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
    ).map((m) => m.id);
    if (msgIds.length > 0) {
      rows = await db
        .select()
        .from(attachments)
        .where(inArray(attachments.messageId, msgIds));
    }
  } else if (messageId) {
    const [msg] = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    if (!msg || !(await isMember(msg.conversationId, me.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, messageId));
  } else {
    return NextResponse.json(
      { error: "conversationId or messageId required" },
      { status: 400 },
    );
  }

  const urls = await signPaths(rows.map((r) => r.storagePath));
  return NextResponse.json(
    rows.map((r) => ({
      messageId: r.messageId,
      kind: r.kind,
      fileName: r.fileName,
      mimeType: r.mimeType,
      url: urls.get(r.storagePath) ?? null,
    })),
  );
}

// POST /api/attachments (multipart: conversationId, file, optional body)
// Uploads an image to the private bucket, creates the message + attachment
// rows. The message INSERT fires Realtime so other members are notified.
export async function POST(request: Request) {
  const me = await getUser();
  if (!me) return unauthorized();

  const form = await request.formData();
  const conversationId = form.get("conversationId");
  const caption = form.get("body");
  const file = form.get("file");

  if (typeof conversationId !== "string" || !conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  // Images only (for now).
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "only image uploads are allowed" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 10MB)" }, { status: 400 });
  }
  if (!(await isMember(conversationId, me.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100) || "image";
  const storagePath = `${conversationId}/${crypto.randomUUID()}-${safeName}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const body =
    typeof caption === "string" && caption.trim() !== ""
      ? caption.trim()
      : null;

  const result = await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messages)
      .values({ conversationId, senderId: me.id, body })
      .returning();
    const [att] = await tx
      .insert(attachments)
      .values({
        messageId: msg.id,
        uploaderId: me.id,
        kind: "image",
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
      })
      .returning();
    return { msg, att };
  });

  const urls = await signPaths([storagePath]);
  return NextResponse.json({
    message: result.msg,
    attachment: {
      messageId: result.msg.id,
      kind: "image",
      fileName: result.att.fileName,
      mimeType: result.att.mimeType,
      url: urls.get(storagePath) ?? null,
    },
  });
}
