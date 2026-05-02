"""
DB connection test script — tries multiple Supabase connection variants.
Run: c:\SDG_1_backend\backend\.venv\Scripts\python.exe test_db.py
"""
import asyncio
import asyncpg

PROJECT_REF = "lsgufbpjrisjkprhdabd"
# URL-decoded password
PASSWORD = "@Sachin@100#"
DATABASE = "postgres"

VARIANTS = [
    # (host, port, user, label)
    ("aws-0-ap-south-1.pooler.supabase.com", 6543, f"postgres.{PROJECT_REF}", "Pooler txn mode (6543) project user"),
    ("aws-0-ap-south-1.pooler.supabase.com", 5432, f"postgres.{PROJECT_REF}", "Pooler session mode (5432) project user"),
    ("aws-0-ap-south-1.pooler.supabase.com", 6543, "postgres", "Pooler txn mode (6543) plain postgres user"),
    ("aws-0-ap-south-1.pooler.supabase.com", 5432, "postgres", "Pooler session mode (5432) plain postgres user"),
]

async def test_variant(host, port, user, label):
    print(f"\n{'='*60}")
    print(f"Testing: {label}")
    print(f"  host={host}  port={port}  user={user}")
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(host=host, port=port, user=user,
                            password=PASSWORD, database=DATABASE),
            timeout=10.0
        )
        ver = await conn.fetchval("SELECT version()")
        print(f"  SUCCESS! PostgreSQL: {ver[:60]}")
        await conn.close()
        return True
    except asyncio.TimeoutError:
        print("  FAIL: Timed out after 10s")
    except Exception as e:
        print(f"  FAIL: {type(e).__name__}: {e}")
    return False

async def main():
    print("Supabase connection probe")
    for host, port, user, label in VARIANTS:
        ok = await test_variant(host, port, user, label)
        if ok:
            print("\n*** Working variant found above ^^^")
            # Build the SQLAlchemy URL for .env
            import urllib.parse
            pw_encoded = urllib.parse.quote(PASSWORD, safe='')
            sa_url = f"postgresql+asyncpg://{user}:{pw_encoded}@{host}:{port}/{DATABASE}"
            print(f"*** SQLAlchemy URL:\n    {sa_url}")

if __name__ == "__main__":
    asyncio.run(main())
