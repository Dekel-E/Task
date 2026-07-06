"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

// xterm.js bound to the backend shared PTY over a WebSocket. Multiple viewers of
// the same terminal id share one PowerShell — output is broadcast to all, and
// input from any viewer goes to the same shell.
export function TerminalView({ terminalId }: { terminalId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("connecting…");

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any, ws: WebSocket | undefined, resizeObs: ResizeObserver | undefined;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      term = new Terminal({
        cursorBlink: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        theme: { background: "#0b0b0b", foreground: "#e5e5e5" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token ?? "";
      const wsUrl = `ws://${window.location.hostname}:8080/ws/terminal/${terminalId}?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(wsUrl);

      const sendResize = () => {
        if (ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
      };

      ws.onopen = () => {
        setStatus("connected");
        sendResize();
      };
      ws.onmessage = (e) => term.write(e.data);
      ws.onclose = (e) =>
        setStatus(e.code === 1008 ? "unauthorized" : "disconnected");
      ws.onerror = () => setStatus("connection error");

      term.onData((d: string) => {
        if (ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "input", data: d }));
      });

      resizeObs = new ResizeObserver(() => {
        try {
          fit.fit();
          sendResize();
        } catch {
          /* container not measurable yet */
        }
      });
      resizeObs.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      try {
        resizeObs?.disconnect();
      } catch {
        /* ignore */
      }
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 py-1 text-xs text-muted-foreground">
        status: <span className="font-medium">{status}</span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 bg-black p-2" />
    </div>
  );
}
