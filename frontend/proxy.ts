import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" convention (formerly middleware.ts). Runs on every matched
// request to refresh Supabase auth cookies and guard private routes.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static assets. API routes are
  // included (so their cookies stay fresh) but are treated as public in
  // updateSession — they enforce auth themselves.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
