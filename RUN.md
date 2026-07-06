# Running WhatsApp+ locally

Local-only dev stack: **Next.js 16** (frontend) + **FastAPI** (backend) +
**Supabase** (Postgres, Auth, Storage, Realtime), all on `localhost`.

## Prerequisites

- **Docker Desktop** (running) — Supabase local stack needs it
- **Node.js ≥ 20** and **Python ≥ 3.11**
- **Supabase CLI** (`supabase`) and **uv** (used by `setup.py`)

## One-time setup

From the project root:

```bash
python setup.py            # installs frontend+backend deps, makes .env files
supabase start             # boots Postgres/Auth/Storage/Realtime in Docker
supabase db reset          # applies all migrations in supabase/migrations/
```

`supabase start` prints keys. They're already filled into `frontend/.env.local`
and `backend/.env` for this checkout; if you ever need to refresh them, run
`supabase status` and copy `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` →
`SUPABASE_JWT_SECRET`.

> **Windows note:** `setup.py` prints Unicode; if the console errors on it, run
> `PYTHONUTF8=1 python setup.py`. `uv` needs the venv Python path with `.exe`.

## Start the app (one command)

```bash
python dev.py
```

`dev.py` boots the whole stack in one terminal: it runs `supabase start`
(idempotent), then launches the backend and frontend together, streaming each
service's output prefixed and colored. It picks the right `.venv` path per OS,
so no more `Scripts` vs `bin` juggling. **Ctrl+C** stops the servers; Supabase
(Docker) stays up for fast restarts — stop it with `supabase stop` when done.
Already have the DB running? `python dev.py --no-supabase`.

Open **http://localhost:3000** and sign up (or use a demo account below).

### Or start each service manually (3 terminals)

```bash
# 1. Database (Docker) — if not already running
supabase start

# 2. Backend (FastAPI) — JWT verify + shared terminal WebSocket
cd backend && .venv/Scripts/uvicorn main:app --reload --port 8080
#   (macOS/Linux: .venv/bin/uvicorn ...)

# 3. Frontend (Next.js)
cd frontend && npm run dev
```

| Service           | URL                          |
|-------------------|------------------------------|
| Frontend          | http://localhost:3000        |
| Backend API       | http://localhost:8080/docs   |
| Supabase Studio   | http://127.0.0.1:54323       |

## Demo accounts

Three seeded users (password `password123`): `alice@example.com`,
`bob@example.com`, `carol@example.com` — already added to each other's
**contacts**, so they can chat immediately. Sign in as two of them in separate
browsers (or a normal + incognito window) to see realtime chat and the shared
terminal live. (A fresh signup starts with an empty contact list.)

## Try it

1. **Contacts** — the pencil (New chat) → add someone by **email**, then start a
   DM. You can only message people on your contact list.
2. **Profile** — click your name/avatar (top of the sidebar) → edit your
   display name and status.
3. **DMs / groups** — messages appear live in the other window (no refresh);
   groups can only include your contacts.
4. **Images** — 📎 in the composer uploads an image (served via signed URL).
5. **Presence / typing** — the DM header shows online/last-seen; "typing…"
   appears while the other person types.
6. **Shared terminal** — Terminals (left rail) → create one → Invite a contact;
   both attach to the **same** PowerShell (type in one, see it in the other).

## Reset

`supabase db reset` wipes and reapplies the schema (drops all users/messages).
