"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

// Fixed grid shared with the backend (terminal.py FIXED_ROWS/FIXED_COLS). The
// shared PTY has one size for all viewers, so the terminal is a fixed COLS×ROWS
// grid rather than fitting each viewer's window — see the note below.
const COLS = 100;
const ROWS = 30;

// xterm.js bound to the backend shared PTY over a WebSocket. Multiple viewers of
// the same terminal id share one PowerShell — output is broadcast to all, and
// input from any viewer goes to the same shell.
//
// The grid is FIXED (COLS×ROWS). A pty stores a single (rows, cols) that the
// shell uses to wrap lines; if each viewer fit xterm to its own window and sent
// that size, the last viewer to connect would clobber the shared size and the
// others' prompts would reflow at the wrong width (the "weird indentation" on
// join/leave). Pinning the grid removes that conflict: every viewer renders the
// same box, centered, and scrolls if their window is smaller. So we deliberately
// do NOT use FitAddon or send resize messages here.
export function TerminalView({ terminalId }: { terminalId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("connecting…");

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any, ws: WebSocket | undefined;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      if (disposed || !containerRef.current) return;

      // Fixed grid: no FitAddon, no ResizeObserver, no resize messages.
      term = new Terminal({
        cols: COLS,
        rows: ROWS,
        cursorBlink: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        theme: { background: "#0b0b0b", foreground: "#e5e5e5" },
      });
      term.open(containerRef.current);

      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token ?? "";
      const wsUrl = `ws://${window.location.hostname}:8080/ws/terminal/${terminalId}?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setStatus("connected");
      ws.onmessage = (e) => term.write(e.data);
      ws.onclose = (e) =>
        setStatus(e.code === 1008 ? "unauthorized" : "disconnected");
      ws.onerror = () => setStatus("connection error");

      term.onData((d: string) => {
        if (ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "input", data: d }));
      });
    })();

    return () => {
      disposed = true;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      try {
        term?.dispose();
      } catch {
        /* ignore */
      }
    };
  }, [terminalId]);

  // The fixed grid is centered; a viewer whose window is smaller than the grid
  // scrolls rather than forcing a reflow (which is what corrupted rendering).
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 py-1 text-xs text-muted-foreground">
        status: <span className="font-medium">{status}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-black p-2">
        <div ref={containerRef} className="mx-auto w-fit" />
      </div>
    </div>
  );
}
