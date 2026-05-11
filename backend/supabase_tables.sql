-- Run this in: Supabase Dashboard → SQL Editor
-- Creates all tables for the chatbot application

CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url  TEXT,
    hashed_password TEXT,
    google_id   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_threads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id ON chat_threads(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);

-- Alembic migration tracking table
-- Stamp with current revision so Alembic CLI knows the DB is up to date
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num)
VALUES ('0001')
ON CONFLICT DO NOTHING;

-- ── Attachments ────────────────────────────────────────────────────────────
-- Note: chat_messages.role CHECK must include 'attachment' — see ALTER below
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_role_check
    CHECK (role IN ('user', 'assistant', 'attachment'));

CREATE TABLE IF NOT EXISTS attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id       UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    thread_id        UUID NOT NULL REFERENCES chat_threads(id)  ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
    file_name        TEXT NOT NULL,
    mime_type        TEXT NOT NULL,
    attachment_type  TEXT NOT NULL CHECK (attachment_type IN ('image','video','pdf','code','excel')),
    file_path        TEXT NOT NULL,
    file_size_bytes  INTEGER NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_thread_id  ON attachments(thread_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id    ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

