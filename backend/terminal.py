"""Shared PTY terminal over WebSockets.

Each terminal id maps to ONE real PowerShell (ConPTY via pywinpty). Multiple
authorized clients attach to the same session: a single background pump reads
the PTY and broadcasts output to every attached socket, and input from any
socket is written to the shared PTY. The PTY is torn down when the last viewer
disconnects.

The grid is a FIXED size (see FIXED_ROWS/FIXED_COLS). A pty has a single
(rows, cols) that the shell uses to wrap lines and place the cursor; letting
each viewer push its own window size meant the last one to connect clobbered
that size, so the shell would reflow the other viewers' prompts at a width that
didn't match their windows (the "weird indentation"). Pinning the size removes
the moving part entirely: every viewer renders the identical grid and resize
messages are ignored. The frontend renders this fixed grid (centered/scrolled),
so it must NOT fit-to-window.

Dev-only: this runs real shell commands on the host with no sandbox. Acceptable
because the app is a local-only demo, and joins are authorized (owner or invited
member) before the socket is accepted.
"""

import asyncio
import json

from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from winpty import PtyProcess

from auth import decode_token
from db import can_access_terminal

# The one true size for every shared terminal. Kept in sync with the frontend's
# xterm grid (terminal-view.tsx). pywinpty takes dimensions as (rows, cols).
FIXED_ROWS = 30
FIXED_COLS = 100


class Session:
    """One shared PTY plus the set of sockets currently attached to it."""

    def __init__(self, terminal_id: str) -> None:
        self.terminal_id = terminal_id
        self.proc: PtyProcess | None = None
        self.clients: set[WebSocket] = set()
        self.pump_task: asyncio.Task | None = None

    def start(self) -> None:
        self.proc = PtyProcess.spawn(
            ["powershell.exe", "-NoLogo"], dimensions=(FIXED_ROWS, FIXED_COLS)
        )
        self.pump_task = asyncio.create_task(self._pump())

    async def _pump(self) -> None:
        """Read PTY output and fan it out to all attached clients."""
        loop = asyncio.get_running_loop()
        try:
            while self.proc is not None:
                data = await loop.run_in_executor(None, self.proc.read, 4096)
                if not data:
                    break
                for ws in list(self.clients):
                    try:
                        await ws.send_text(data)
                    except Exception:
                        self.clients.discard(ws)
        except (EOFError, OSError, RuntimeError):
            pass
        finally:
            await self.close()

    async def close(self) -> None:
        proc, self.proc = self.proc, None
        if proc is not None:
            try:
                proc.terminate(force=True)
            except Exception:
                pass
        for ws in list(self.clients):
            try:
                await ws.close()
            except Exception:
                pass
        self.clients.clear()


_SESSIONS: dict[str, Session] = {}
_LOCK = asyncio.Lock()


async def terminal_session(ws: WebSocket, terminal_id: str, token: str) -> None:
    # Accept first so we can close with an explicit 1008 (policy violation) that
    # the client can read; closing before accept would surface only as a generic
    # handshake failure.
    await ws.accept()

    # Authenticate (the browser passes the Supabase access token as ?token=,
    # since WebSockets can't set an Authorization header) ...
    try:
        user = decode_token(token)
    except HTTPException:
        await ws.close(code=1008)  # policy violation
        return
    # ... then authorize: only the owner or an invited member may attach.
    if not await can_access_terminal(terminal_id, user.id):
        await ws.close(code=1008)
        return

    async with _LOCK:
        session = _SESSIONS.get(terminal_id)
        if session is None or session.proc is None:
            session = Session(terminal_id)
            session.start()
            _SESSIONS[terminal_id] = session
        session.clients.add(ws)

    try:
        while True:
            raw = await ws.receive_text()
            if session.proc is None:
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                session.proc.write(raw)
                continue
            kind = msg.get("type")
            if kind == "input":
                session.proc.write(msg.get("data", ""))
            # "resize" is intentionally ignored: the grid is fixed (see module
            # docstring). Honoring per-client resizes is what caused viewers to
            # clobber each other's rendering.
    except WebSocketDisconnect:
        pass
    finally:
        session.clients.discard(ws)
        async with _LOCK:
            if not session.clients and _SESSIONS.get(terminal_id) is session:
                await session.close()
                _SESSIONS.pop(terminal_id, None)
