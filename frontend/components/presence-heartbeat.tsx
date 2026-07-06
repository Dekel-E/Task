"use client";

import { useEffect } from "react";

// Invisible: marks the signed-in user online now and every 25s while any
// authenticated page is open. Rendered once from the NavRail.
export function PresenceHeartbeat() {
  useEffect(() => {
    const ping = () =>
      fetch("/api/presence", { method: "POST" }).catch(() => {});
    ping();
    const id = setInterval(ping, 25_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
