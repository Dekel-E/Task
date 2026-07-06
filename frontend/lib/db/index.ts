import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Server-only Drizzle client over the direct Postgres connection
// (DATABASE_URL). Bypasses RLS — never import from client components.
// `prepare: false` is required for the Supabase transaction pooler.
// Bounded pool + idle timeout so dev restarts don't hoard Postgres slots
// (local Postgres allows only ~100 connections).
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 8,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
