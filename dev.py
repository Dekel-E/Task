#!/usr/bin/env python3
"""One-command dev launcher. Run from the project root:

    python3 dev.py

Boots the whole local stack and streams every service's output, prefixed,
into this one terminal:

  1. supabase start   (idempotent — skips if already running; needs Docker)
  2. backend          .venv uvicorn on :8080
  3. frontend         next dev on :3000

Press Ctrl+C once to stop backend + frontend. Supabase (Docker) keeps running
so restarts are fast; stop it yourself with `supabase stop` when done.

Skip Supabase (e.g. it's already up) with:  python3 dev.py --no-supabase
"""

import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"

IS_WIN = sys.platform == "win32"
NPM = "npm.cmd" if IS_WIN else "npm"
BIN = "Scripts" if IS_WIN else "bin"

# ANSI colors so each service's lines are easy to tell apart.
COLORS = {"backend": "\033[36m", "frontend": "\033[35m", "supabase": "\033[33m"}
RESET = "\033[0m"


def _pump(name: str, stream) -> None:
    """Forward one child's output to our stdout, prefixed and colored."""
    color = COLORS.get(name, "")
    for line in iter(stream.readline, ""):
        sys.stdout.write(f"{color}[{name}]{RESET} {line}")
        sys.stdout.flush()
    stream.close()


def start_supabase() -> bool:
    """Bring the local DB up. Idempotent; returns False if the CLI is missing."""
    from shutil import which

    if not which("supabase"):
        print("  ! supabase CLI not found — starting without a local DB.")
        print("    install it (needs Docker), then re-run, or use --no-supabase.")
        return False
    print(f"{COLORS['supabase']}[supabase]{RESET} starting (idempotent)…")
    # Blocking: we want the DB ready before the servers come up.
    return subprocess.run(["supabase", "start"], cwd=ROOT).returncode == 0


def spawn(name: str, cmd: list[str], cwd: Path) -> subprocess.Popen:
    print(f"{COLORS.get(name, '')}[{name}]{RESET} $ {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        # Force UTF-8: child tools (Next.js, uvicorn) emit UTF-8, but Python
        # would otherwise decode with the OS locale codec (e.g. cp1255 on a
        # Hebrew Windows) and crash on box-drawing chars like "▲". errors=
        # "replace" keeps the pump alive even on the odd undecodable byte.
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        # New process group so Ctrl+C here doesn't race the children's own
        # signal handling — we terminate them explicitly.
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if IS_WIN else 0,
    )
    threading.Thread(target=_pump, args=(name, proc.stdout), daemon=True).start()
    return proc


def main() -> int:
    # Our own console may be a non-UTF-8 code page (e.g. cp1255); make writes of
    # forwarded child output (which can contain any Unicode) never crash.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    if not (BACKEND / ".venv").exists():
        print("Backend .venv missing — run `python3 setup.py` first.")
        return 1

    if "--no-supabase" not in sys.argv:
        start_supabase()

    uvicorn = BACKEND / ".venv" / BIN / ("uvicorn.exe" if IS_WIN else "uvicorn")
    procs = [
        spawn(
            "backend",
            [str(uvicorn), "main:app", "--reload", "--port", "8080"],
            BACKEND,
        ),
        spawn("frontend", [NPM, "run", "dev"], FRONTEND),
    ]

    print("\n  ▸ frontend  http://localhost:3000")
    print("  ▸ backend   http://localhost:8080/docs")
    print("  Ctrl+C to stop.\n")

    def shutdown(*_):
        print("\nStopping…")
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if not IS_WIN:
        signal.signal(signal.SIGTERM, shutdown)

    # If either server dies on its own, tear the other down too.
    while True:
        for p in procs:
            code = p.poll()
            if code is not None:
                print(f"\nA service exited (code {code}) — shutting down.")
                shutdown()
        try:
            os.waitpid(-1, 0) if not IS_WIN else procs[0].wait(timeout=1)
        except (ChildProcessError, subprocess.TimeoutExpired):
            pass


if __name__ == "__main__":
    sys.exit(main())
