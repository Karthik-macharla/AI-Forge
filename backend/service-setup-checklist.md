# External Service Setup Checklist

## ATG AI Chatbot Course

This document lists every external account, service, and credential students need to set up during the course. Complete each setup before the session that requires it — some take a few minutes, some require waiting for access approvals.

---

## Setup Timeline

| When | Setup Required |
| :---- | :---- |
| Before Day 1 | Development environment, Amzur LiteLLM virtual key |
| Before P2 | Supabase (PostgreSQL database) |
| Before P3 | Google Cloud Console (OAuth credentials) |
| Before P9 | Google Cloud Console (Service Account for Sheets) |

## 1\. Development Environment

**Required before: Day 1**

### Tools to install

| Tool | Version | Download |
| :---- | :---- | :---- |
| VS Code | Latest | code.visualstudio.com |
| Python | 3.11+ | python.org |
| Node.js | 18+ | nodejs.org |
| Git | Latest | git-scm.com |

### VS Code extensions to install

- **GitHub Copilot** — the core tool for the course  
- **GitHub Copilot Chat** — required for Copilot Chat panel

### Verify everything works

```shell
python --version        # should show 3.11+
node --version          # should show 18+
npm --version           # should show 9+
git --version           # any recent version 
```

### Python virtual environment

Students should create a virtual environment inside the backend/ folder:

```shell
cd backend
python -m venv .venv

# Activate — Windows
.venv\Scripts\activate

# Activate — Mac/Linux
source .venv/bin/activate
```

## 2\. Amzur LiteLLM Virtual Key

**Required before: P1**

This is issued by the Amzur administrator — students do not create this themselves.

### What it is

A single API key (sk-...) that grants access to all AI models available through the Amzur LiteLLM proxy at https://litellm.amzur.com. It replaces individual provider keys (OpenAI, Google, etc.).

### What to do

1. Request your virtual key from your team lead or Amzur admin before the course starts  
2. Once received, add it to your .env file:

```
LITELLM_PROXY_URL=https://litellm.amzur.com
LITELLM_API_KEY=sk-your-key-here
```

3. Verify your virtual key works  
   Run the following command to confirm your key has access to the proxy and see the available models.  
   

**Mac / Linux:**

```shell
curl https://litellm.amzur.com/v1/models \
  -H "Authorization: Bearer sk-your-virtual-key-here"
```

**Windows (Command Prompt):**

```
curl https://litellm.amzur.com/v1/models -H "Authorization: Bearer sk-your-virtual-key-here"
```

**Windows (PowerShell):**

```
Invoke-WebRequest -Uri "https://litellm.amzur.com/v1/models" `
  -Headers @{ "Authorization" = "Bearer sk-your-virtual-key-here" }
```

**Expected Output:** A successful response returns a JSON object listing the models your key has access to:

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini/gemini-2.5-flash",
      "object": "model",
      "created": 1234567890,
      "owned_by": "litellm"
    },
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1234567890,
      "owned_by": "litellm"
    },
    {
      "id": "text-embedding-3-large",
      "object": "model",
      "created": 1234567890,
      "owned_by": "litellm"
    },
    {
      "id": "gemini/imagen-4.0-fast-generate-001",
      "object": "model",
      "created": 1234567890,
      "owned_by": "litellm"
    }
  ]
}
```

If the command returns a model list that includes gemini/gemini-2.5-flash, gpt-4o, text-embedding-3-large, and gemini/imagen-4.0-fast-generate-001 you are fully set up and ready to start.

### VPN requirement

The LiteLLM proxy at `litellm.amzur.com` uses a public IP — no VPN is required to reach it. A standard internet connection is sufficient.

If you see `httpx.ConnectError: getaddrinfo failed`, check your internet connection and verify `LITELLM_PROXY_URL` is set correctly in your `.env` file.

Verify the hostname resolves:

```shell
nslookup litellm.amzur.com
# Should resolve to an internal IP — not an error
```

## 3\. Supabase (PostgreSQL Database)

**Required before: P2**

Each student needs their own free Supabase project. Do not share a database with another student.

### Setup steps

1. Go to [supabase.com](https://supabase.com) and sign up or log in  
2. Click **New Project**  
3. Fill in:  
   - **Name:** amzur-chatbot (or any name)  
   - **Database password:** choose a strong password and save it somewhere — you will need it  
   - **Region:** choose the closest to your location  
4. Click **Create new project** and wait \~2 minutes for provisioning

### Get your connection string

1. In your project, go to **Settings → Database**  
2. Scroll to **Connection string**  
3. Select the **URI** tab  
4. Copy the string — it looks like:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

5. **Important:** change postgresql:// to postgresql+asyncpg:// and replace \[YOUR-PASSWORD\] with your actual password  
6. Add to .env:

```
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

### Notes

- The free tier supports up to 20 concurrent connections — sufficient for individual development  
- **Never commit your DATABASE\_URL to Git** — it contains your password  
- Supabase's **Table Editor** is useful for verifying data during development — use it to confirm rows are being created correctly

## 4\. Google Cloud Console — OAuth 2.0 Credentials

**Required before: P3**

Used to enable "Sign in with Google" in the application.

### One-time project setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)  
2. Click the project dropdown (top left) → **New Project**  
3. Name it amzur-chatbot-dev → **Create**  
4. Make sure the new project is selected before continuing

### Enable the People API

1. Go to **APIs & Services → Library**  
2. Search **Google People API** → click it → **Enable**

### Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**  
2. Select **External** → **Create**  
3. Fill in:  
   - **App name:** Amzur Chatbot  
   - **User support email:** your email  
   - **Developer contact email:** your email  
4. Click **Save and Continue** through the Scopes screen (no changes needed)  
5. On **Test Users**, add your own Amzur email address — only listed emails can log in while in testing mode  
6. Click **Save and Continue** → **Back to Dashboard**

Leave the app in **Testing** mode for the entire course. Publishing requires Google verification, which is not needed here.

### Create OAuth credentials

1. Go to **APIs & Services → Credentials**  
2. Click **\+ Create Credentials → OAuth client ID**  
3. Application type: **Web application**  
4. Name: amzur-chatbot-local  
5. Under **Authorised JavaScript origins**, add:

```
http://localhost:5173
```

6. Under **Authorised redirect URIs**, add:

```
http://localhost:8000/api/auth/google/callback
```

7. Click **Create**

### Copy credentials to .env

From the confirmation dialog:

```
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### Common mistakes

- The redirect URI in Google Cloud Console and GOOGLE\_REDIRECT\_URI in .env must be **character-for-character identical** — same protocol, same port, same path, no trailing slash. A mismatch causes redirect\_uri\_mismatch error.  
- Your own email must be added to the **Test Users** list or Google will reject your login attempt.  
- Each student needs their own Google Cloud project and credentials — credentials cannot be shared.

## 5\. ChromaDB

**Required before: P7**

ChromaDB runs locally — no account or sign-up required. It persists to a folder on disk.

### Setup

1. Add to requirements.txt :

```
chromadb
```

2. Install:

```shell
pip install chromadb --break-system-packages
# or inside venv:
pip install chromadb
```

3. Set the persist directory in .env:

```
CHROMA_PERSIST_DIR=./chroma_db
```

4. The chroma\_db/ folder will be created automatically on first use

### Notes

- Add chroma\_db/ to .gitignore — it contains binary index files and should not be committed  
- If ChromaDB throws errors on startup, verify the CHROMA\_PERSIST\_DIR folder exists or let the client create it on first write  
- Each user's documents are stored in an isolated collection (user\_{user\_id}) — collections are created automatically

## 6\. OpenAI Embeddings Access

**Required before: P7**

Embeddings (text-embedding-3-large) are accessed through the **Amzur LiteLLM proxy** using your existing virtual key — no separate OpenAI account or API key is required.

### What this means in practice

```py
# Correct — routes through LiteLLM proxy
embeddings = OpenAIEmbeddings(
    model=settings.LITELLM_EMBEDDING_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
)

# Wrong — never call OpenAI directly
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    api_key="sk-openai-key"  # ← This is not how this project works
)
```

Add to .env:

```
LITELLM_EMBEDDING_MODEL=text-embedding-3-large
```

## 7\. Google Cloud Console — Service Account (Google Sheets)

**Required before: P9**

Used to allow the application to read Google Sheets programmatically.

### Create a Service Account

1. In your existing Google Cloud project, go to **IAM & Admin → Service Accounts**  
2. Click **\+ Create Service Account**  
3. Name: amzur-chatbot-sheets  
4. Click **Create and Continue** → **Done** (no role assignment needed for Sheets access)  
5. Click on the service account you just created  
6. Go to the **Keys** tab → **Add Key → Create new key → JSON**  
7. A .json file downloads automatically — open it and keep it safe

### Add credentials to .env

**Option A — File path (recommended for simplicity):** Save the .json file outside your project folder, then:

```
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/your/service-account.json
```

**Option B — Inline JSON string:** Minify the JSON to a single line and wrap in single quotes:

```
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...",...}'
```

### Add to .gitignore

```
# Prevent service account key from being committed
*.json
!package.json
!tsconfig.json
!*.config.json
```

### Share each Google Sheet with the service account

Before querying any Google Sheet:

1. Open the sheet in Google Sheets  
2. Click **Share**  
3. Paste the service account's client\_email (found in the .json file — looks like amzur-chatbot-sheets@your-project.iam.gserviceaccount.com)  
4. Set permission to **Viewer** → **Share**

This step is required for every sheet. Without it the API returns a 403 even if all credentials are correct.

## Quick Reference — All .env Variables

Complete .env file with all variables across all projects:

```
# ── App ────────────────────────────────────────────────────────
SECRET_KEY=                          # Any long random string — run: python -c "import secrets; print(secrets.token_hex(32))"
JWT_EXPIRE_MINUTES=480
APP_NAME=amzur-ai-chat
ENVIRONMENT=development

# ── Database (Supabase) ────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@db.xxxx.supabase.co:5432/postgres

# ── Amzur LiteLLM Proxy ────────────────────────────────────────
LITELLM_PROXY_URL=https://litellm.amzur.com
LITELLM_API_KEY=sk-                  # Virtual key from Amzur admin
LLM_MODEL=gemini-2.0-flash          # or gpt-4o, gpt-4o-mini
LITELLM_EMBEDDING_MODEL=text-embedding-3-large
IMAGE_GEN_MODEL=gemini-2.0-flash

# ── Google OAuth (Project 3+) ──────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# ── ChromaDB (Project 7+) ──────────────────────────────────────
CHROMA_PERSIST_DIR=./chroma_db

# ── Google Sheets Service Account (Project 9+) ─────────────────
GOOGLE_SERVICE_ACCOUNT_JSON=         # File path or inline JSON string

# ── File Uploads ───────────────────────────────────────────────
MAX_UPLOAD_MB=20
UPLOAD_DIR=./uploads
```

---

## Common Setup Errors

| Error | Cause | Fix |
| :---- | :---- | :---- |
| httpx.ConnectError: getaddrinfo failed | Network connectivity issue or wrong proxy URL  | Check internet connection, verify `LITELLM_PROXY_URL` in `.env`, run `nslookup litellm.amzur.com`  |
| redirect\_uri\_mismatch | OAuth redirect URI mismatch | Check GOOGLE\_REDIRECT\_URI exactly matches Google Cloud Console |
| 403 Forbidden on Google Sheets | Sheet not shared with service account | Share the sheet with the service account email |
| ModuleNotFoundError: psycopg2 | Missing sync DB driver | Add psycopg2-binary to requirements.txt, reinstall |
| ModuleNotFoundError: gspread | Missing package | Add gspread to requirements.txt, reinstall |
| alembic upgrade head fails | DATABASE\_URL not set or wrong prefix | Check .env has postgresql+asyncpg:// prefix |
| ValidationError on FastAPI startup | Non-optional settings field missing from .env | Add missing var to .env or type field as Optional\[str\] \= None |
| npm create vite hangs on template selection | Wrong command | Use npx create-vite@latest frontend \--template react-ts |

