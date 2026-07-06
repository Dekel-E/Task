"""Minimal direct Postgres access for the backend.

The FastAPI service is otherwise stateless (it verifies JWTs and runs the shared
terminal). It needs exactly one DB query: authorize a WebSocket join to a shared
terminal (owner or invited member). Uses asyncpg over DATABASE_URL.
"""

import os
from uuid import UUID

import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ["DATABASE_URL"], min_size=1, max_size=5
        )
    return _pool


async def can_access_terminal(terminal_id: str, user_id: str) -> bool:
    """True if user owns the terminal or is one of its invited members."""
    try:
        tid = UUID(terminal_id)
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return False

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            select 1
            from public.terminals t
            where t.id = $1
              and (
                t.owner_id = $2
                or exists (
                  select 1 from public.terminal_members m
                  where m.terminal_id = t.id and m.user_id = $2
                )
              )
            """,
            tid,
            uid,
        )
        return row is not None
