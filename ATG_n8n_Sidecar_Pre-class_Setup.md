# ATG n8n Sidecar — Pre-class Setup

**Before you start:** the service-setup-checklist is complete. You already have:

- A development environment (Python 3.11+, Node 18+, VS Code)
- An Amzur LiteLLM virtual key (`LITELLM_API_KEY` in your chatbot `.env`)
- A Supabase project with your chatbot database running (`DATABASE_URL` in your `.env`)
- A Google Cloud project with OAuth credentials for chatbot login (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- A Google Service Account for Sheets (`GOOGLE_SERVICE_ACCOUNT_JSON`)

This guide adds **only what is needed for the n8n sidecar session**. Do not recreate anything already set up.

**Time required:** 20–30 minutes.  
**If you get stuck:** post in the training Slack channel.

---

## What You Need Ready

By the end of this setup you should have:

- An n8n Cloud instance at `https://<yourname>.app.n8n.cloud`
- LiteLLM (training) credential in n8n (uses your existing virtual key)
- Postgres (training) credential in n8n connected to your existing Supabase project
- Gmail (training) credential in n8n (uses your existing Google Cloud project)
- A `tickets` table created in your Supabase database
- A `verify_setup` workflow confirming n8n can call the LLM

---

## Part 1 — Create n8n Cloud Account

1. Go to **n8n.io** → **Get started for free**
2. Sign up with an email you can access during class
3. After signup, your instance URL will be: `https://<yourname>.app.n8n.cloud`
4. Complete the owner account setup when prompted
5. Confirm you land on the **Overview** page (shows Workflows and recent activity)

> **Note:** Use a personal Gmail if possible. Corporate Google Workspace accounts sometimes block OAuth for external apps.

---

## Part 2 — Add LiteLLM Credential in n8n

You already have an Amzur LiteLLM virtual key from the service-setup-checklist. You just need to register it in n8n.

Use the values from your existing chatbot `.env`:

| n8n Field | Value from your `.env` |
|-----------|------------------------|
| API Key   | `LITELLM_API_KEY`      |
| Base URL  | `LITELLM_PROXY_URL` (must end with `/v1`) |

**Steps:**

1. Click the **+** button at the top of the left sidebar (next to the n8n logo)
2. Hover **Credential** → click **Personal**
3. Search **OpenAI** → select **OpenAI**
4. Fill in the fields:
   - **API Key:** paste your `LITELLM_API_KEY`
   - **Base URL:** paste your `LITELLM_PROXY_URL` — confirm it ends with `/v1` (e.g. `https://litellm.amzur.com/v1`)
5. Leave **Organization ID** blank
6. Click **Save** → name it `LiteLLM (training)`
7. Confirm the credential test turns **green**

> **Note:** If the Base URL field is blank or missing, n8n will call OpenAI directly and fail. The Base URL is required.

---

## Part 3 — Add Supabase PostgreSQL Credential in n8n

Your chatbot app connects directly to Supabase on port 5432. n8n Cloud needs to use the **Transaction Mode connection pooler on port 6543** — this handles the many short-lived connections from a serverless environment without exhausting Supabase's connection limit.

### 3.1 — Get the pooler connection string from Supabase

1. Open your Supabase project dashboard
2. Click the **Connect** button in the top bar (next to the branch name)
3. In the Connect dialog, select the **Connection string** tab → choose **Transaction** mode
4. Copy the connection string:
   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

> **Note:** The Database → Settings page only shows pool size configuration — the actual connection strings are only in the Connect dialog.

### 3.2 — Create the credential in n8n

1. Click **+** → hover **Credential** → **Personal** → search **PostgreSQL** → select **PostgreSQL**
2. Fill in the fields using the pooler connection string:

| Field    | Value                                    |
|----------|------------------------------------------|
| Host     | `aws-0-<region>.pooler.supabase.com`     |
| Port     | `6543`                                   |
| Database | `postgres`                               |
| User     | `postgres.<project-ref>`                 |
| Password | your Supabase database password          |
| SSL      | **Disable**                              |

3. Click **Save** → name it `Postgres (training)`
4. Click **Test connection** — confirm it passes

> ⚠️ **Port 6543 only.** Do not use port 5432 (direct connection) for n8n. The pooler is required for n8n Cloud's connection pattern.

---

## Part 4 — Enable Gmail in Your Google Cloud Project

You already have a Google Cloud project from the chatbot setup. You need to enable the Gmail API and add an n8n redirect URI to the existing OAuth client.

### 4.1 — Enable Gmail API

1. Go to `console.cloud.google.com`
2. Select your existing **amzur-chatbot-dev** project
3. Go to **APIs & Services** → **Library**
4. Search **Gmail API** → click it → **Enable**

### 4.2 — Add n8n redirect URI to your existing OAuth client

1. Go to **APIs & Services** → **Credentials**
2. Click the Web Application OAuth client you created for the chatbot
3. Under **Authorised redirect URIs**, click **+ Add URI** and add:
   ```
   https://<yourname>.app.n8n.cloud/rest/oauth2-credential/callback
   ```
4. Click **Save**

> **Note:** Your email must already be in the Test Users list from the earlier Google OAuth setup. If not, add it under **OAuth consent screen** → **Test users**.

### 4.3 — Add Gmail credential in n8n

1. Click **+** → hover **Credential** → **Personal** → search **Gmail** → select **Gmail OAuth2**
2. Paste the same **Client ID** and **Client Secret** from your Google Cloud OAuth client
3. Click **Sign in with Google** → authorize with your Gmail account
4. Click **Save** → name it `Gmail (training)`

> **Note:** If Gmail OAuth fails (e.g. `redirect_uri_mismatch`), double-check the redirect URI in step 4.2 exactly matches your n8n instance URL. If it still fails, continue to Part 5 — Gmail can be set up during the session without blocking the rest.

---

## Part 5 — Create the `tickets` Table in Supabase

The n8n sidecar stores tickets in your Supabase database. Create the table now so it exists when you test.

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **+ New query**
3. Paste and run:

```sql
CREATE TABLE IF NOT EXISTS tickets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    text        UNIQUE NOT NULL,
  user_email   text        NOT NULL,
  issue        text        NOT NULL,
  category     text        NOT NULL DEFAULT 'General',
  priority     text        NOT NULL DEFAULT 'medium',
  status       text        NOT NULL DEFAULT 'open',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  thread_id    text,
  assigned_team text,
  next_action  text
);
```

4. Click **Table Editor** in the left sidebar — confirm `tickets` appears in the table list

> ⚠️ **Important:** This table is **not** created by the existing Alembic migrations. You must create it manually here. Without it, the first ticket creation call will return a 502 error.

---

## Part 6 — Add n8n Environment Variables to Your App

The actual webhook URLs are generated during the session, but add the variable names to your `.env` now so the app boots cleanly before the session.

Open your chatbot `.env` and add at the bottom:

```env
# ── n8n automation sidecar (fill in after activating workflows in session) ──
N8N_WEBHOOK_URL=
N8N_API_KEY=
N8N_STATUS_WEBHOOK_URL=
```

Leave the values blank. The app boots without them. Do the same in `.env.example` so the variable names are documented.

---

## Part 7 — Verify n8n + LiteLLM

Build a small workflow to confirm n8n can reach the model before the session.

1. Click the **+** button at the top of the left sidebar → hover **Workflow** → click **Personal**
2. Click the workflow title at the top → rename it `verify_setup`
3. Click **+** on the canvas → search **Chat Trigger** → select it
4. Click **+** on the Chat Trigger output → search **AI Agent** → select it
5. In the AI Agent node: set **Source for Prompt** to **Connected Chat Trigger Node**
6. Click **+** on the AI Agent's **Chat Model** port → search **OpenAI Chat Model** → select it
   - **Credential:** `LiteLLM (training)`
   - **Model:** `gpt-4o`
   - **Expand Options** → set **Use Responses API** to **OFF**
7. Click **Save** (`Ctrl+S`)
8. Click the **Chat** button at the bottom of the canvas → send: `Hello, are you working?`
9. A meaningful reply confirms n8n + LiteLLM is ready.

> **Note:** If the model hangs or errors, confirm `gpt-4o` is available on the training LiteLLM key. Ask your trainer.

---

## Part 8 — Optional: Add n8n Docs MCP Server in VS Code

This step is optional but recommended. It gives you direct access to n8n documentation inside VS Code through an MCP server, so you can quickly ask documentation-based questions while building workflows.

This does **not** replace n8n Cloud, LiteLLM, Supabase, or Gmail setup. It is only a documentation helper for learners while they are working on the chatbot and n8n sidecar integration.

### Why we are adding this

During the n8n sidecar session, learners may need to quickly check:

- How a specific n8n node works
- What configuration a node expects
- How webhooks, credentials, HTTP Request, Gmail, Postgres, or AI Agent nodes are used
- How to troubleshoot common n8n workflow issues
- How to understand n8n concepts without switching repeatedly between browser tabs

The n8n Docs MCP server helps bring n8n documentation closer to the development environment.

### Add MCP configuration in VS Code

In your project, create or update the following file: `.vscode/mcp.json`

Add this configuration:

```json
{
  "servers": {
    "n8n-docs": {
      "type": "http",
      "url": "https://n8n.mcp.kapa.ai/"
    }
  },
  "inputs": []
}
```

Save the file.

### Verify the MCP server is running

After saving the file, VS Code should show the MCP server as:

```
Running | Stop | Restart | tools | More...
```

---

## Pre-session Checklist

### Required (must be done before the session)

- [ ] n8n Cloud opens at your instance URL (`https://<yourname>.app.n8n.cloud`)
- [ ] LiteLLM (training) credential is saved — credential test is green
- [ ] Postgres (training) credential connects to Supabase on port 6543 — test connection passes
- [ ] `tickets` table visible in Supabase **Table Editor**
- [ ] n8n env vars added to `.env` (values blank is fine — app must boot without errors)
- [ ] `verify_setup` workflow returns a model response

### Recommended (can be completed during session if needed)

- [ ] Gmail (training) credential is authorized in n8n
- [ ] Gmail API is enabled in your Google Cloud project
- [ ] n8n OAuth redirect URI is added to your Google Cloud OAuth client

---

## What to Add to Your `.env`

All your existing variables stay unchanged. Add only these three lines at the bottom of your `.env` and `.env.example`:

```env
# n8n automation sidecar (fill in after activating workflows in session)
N8N_WEBHOOK_URL=
N8N_API_KEY=
N8N_STATUS_WEBHOOK_URL=
```

Leave the values blank for now. The app boots without them.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| LiteLLM credential test fails | Check API key and Base URL. The Base URL must end with `/v1` (e.g. `https://litellm.amzur.com/v1`). Confirm you are using the training key from your `.env`. |
| Can't find the credential menu | Click the **+** button at the top-left → hover **Credential** → **Personal**. To view existing credentials, go to **Overview** → **Credentials** tab. |
| OpenAI credential type not found | Search just "OpenAI" — the credential is listed as **OpenAI** (not "OpenAi account"). |
| Chat model hangs in verify_setup | Confirm `gpt-4o` is enabled on the training LiteLLM key. Turn **Use Responses API** OFF on the OpenAI Chat Model node. |
| PostgreSQL connection refused | Confirm you are using port `6543` (pooler) not `5432` (direct). Set SSL to **Disable**. |
| self-signed certificate in certificate chain | Set SSL to **Disable** in the PostgreSQL credential. Disabling SSL is safe here — Supabase does not enforce SSL on incoming pooler connections. |
| PostgreSQL auth fails | Re-copy the password from the Supabase pooler connection string — it may be URL-encoded. |
| tickets table not found in Table Editor | Run the Part 5 SQL in the SQL Editor. The table is not created by Alembic. |
| Gmail redirect_uri_mismatch | The n8n redirect URI must be added to the **same OAuth client** used by the chatbot. Copy the URI exactly: `https://<yourname>.app.n8n.cloud/rest/oauth2-credential/callback` |
| Gmail app blocked | Your email must be in the Test Users list under **OAuth consent screen** → **Test users**. Add it if it's missing. |
| Failed to parse. Expected object, received array | Turn **Use Responses API** OFF on the OpenAI Chat Model node. |
| AI Agent answers but ignores chat input | Set AI Agent **Source for Prompt** to **Connected Chat Trigger Node**. |

---

*If the required checklist is complete, you are ready for the session. The Gmail credential can be set up during the session if needed.*
