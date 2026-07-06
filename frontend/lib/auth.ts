import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Resolve the authenticated user in a server context (route handler / server
// component). Returns null when not signed in.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Standard 401 for route handlers.
export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
