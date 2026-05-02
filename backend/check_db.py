"""Check what's stored in the SQLite database."""
import sqlite3

conn = sqlite3.connect("chatbot.db")
conn.row_factory = sqlite3.Row

print("=== PROFILES (users) ===")
rows = conn.execute("SELECT id, email, display_name, created_at FROM profiles").fetchall()
if rows:
    for r in rows:
        print(f"  {r['email']} | name={r['display_name']} | id={r['id']}")
else:
    print("  (no users registered yet)")

print()
print("=== CHAT THREADS ===")
rows = conn.execute("SELECT id, title, created_at, updated_at FROM chat_threads ORDER BY created_at").fetchall()
if rows:
    for r in rows:
        print(f"  [{r['title']}] id={r['id']} created={r['created_at']}")
else:
    print("  (no threads yet)")

print()
print("=== MESSAGES (last 15) ===")
rows = conn.execute(
    "SELECT m.role, m.content, m.created_at, t.title "
    "FROM chat_messages m "
    "JOIN chat_threads t ON t.id = m.thread_id "
    "ORDER BY m.created_at DESC LIMIT 15"
).fetchall()
if rows:
    for r in rows:
        content = r["content"][:90] + "..." if len(r["content"]) > 90 else r["content"]
        print(f"  [{r['role']:9}] thread='{r['title']}' | {content}")
else:
    print("  (no messages yet)")

print()
counts = conn.execute("SELECT (SELECT COUNT(*) FROM profiles) AS u, (SELECT COUNT(*) FROM chat_threads) AS t, (SELECT COUNT(*) FROM chat_messages) AS m").fetchone()
print(f"TOTALS: {counts['u']} users | {counts['t']} threads | {counts['m']} messages")

conn.close()
