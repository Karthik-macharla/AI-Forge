# AI-Forge

Internal AI chat platform for Amzur / Stackyon — built with FastAPI, LangChain, React 19, and Supabase.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI · LangChain LCEL · Python 3.11 |
| Auth | JWT (httpOnly cookie) · Google OAuth 2.0 |
| Database | Supabase (PostgreSQL) · SQLAlchemy 2.0 · Alembic |
| LLM | LiteLLM proxy → Gemini 2.5 Flash |
| Frontend | React 19 · TypeScript · Tailwind v4 · Vite |
| State | Zustand v5 · TanStack Query v5 |

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in your secrets
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

- `SECRET_KEY` — JWT signing secret (`python -c "import secrets; print(secrets.token_hex(32))"`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — from Supabase dashboard
- `LITELLM_PROXY_URL` / `LITELLM_API_KEY` — Amzur LiteLLM proxy
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud OAuth 2.0 credentials

## Database migrations (Alembic)

```bash
cd backend
alembic upgrade head   # apply all migrations
alembic stamp head     # mark DB as up-to-date without running migrations
```

## Organisation email restriction

Only `@amzur.com` and `@stackyon.com` email addresses can register (configured via `ALLOWED_EMAIL_DOMAINS` in `.env`).
