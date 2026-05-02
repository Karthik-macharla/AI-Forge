"""Quick DB setup test — run from backend/ dir."""
import asyncio
import sys
sys.path.insert(0, ".")

from sqlalchemy import text
from app.db.session import engine, Base
import app.models  # noqa — registers all ORM classes


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created OK")
        result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        print("Tables:", [row[0] for row in result])


asyncio.run(main())
