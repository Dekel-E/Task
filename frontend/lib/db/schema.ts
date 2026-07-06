import {
  bigint,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// TypeScript mirror of the canonical SQL schema in supabase/migrations/.
// After changing a migration, update this mirror (or regenerate it from the
// live local DB with `npm run db:pull`). Used by the server-side Drizzle
// client (lib/db/index.ts) in Next route handlers.

// One row per auth.users account, holding app-facing identity + presence.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarPath: text("avatar_path"),
  statusText: text("status_text").notNull().default("Hey there! I am using WhatsApp+."),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A user's private contact list (one-directional: owner added contact).
export const contacts = pgTable(
  "contacts",
  {
    ownerId: uuid("owner_id").notNull(),
    contactId: uuid("contact_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.contactId] }),
    index("contacts_owner_idx").on(t.ownerId),
  ],
);

// A chat thread: a 1:1 'dm' or a 'group'.
export const conversation = pgTable("conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull().default("dm"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Membership of a conversation (a DM has two rows, a group has N).
export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    lastTypingAt: timestamp("last_typing_at", { withTimezone: true }),
    // Per-user "delete chat": when set, this member has hidden/cleared the
    // conversation up to this time (see migration 20260701009000).
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_members_user_idx").on(t.userId),
  ],
);

// A message. `body` is nullable so a message can be attachment-only.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// Group metadata for a conversation of type 'group'.
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().unique(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// File attached to a message. Bytes live in the private 'attachments' bucket.
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id"),
    uploaderId: uuid("uploader_id").notNull(),
    kind: text("kind").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attachments_message_idx").on(t.messageId)],
);

// A shared terminal session. Opening it attaches to a PTY shell over WS.
export const terminals = pgTable(
  "terminals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("terminals_owner_idx").on(t.ownerId)],
);

// Grants a user access to attach to a shared terminal (owner + invitees).
export const terminalMembers = pgTable(
  "terminal_members",
  {
    terminalId: uuid("terminal_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.terminalId, t.userId] }),
    index("terminal_members_user_idx").on(t.userId),
  ],
);
