"""
Public n8n integration endpoint — secured by X-N8N-API-Key header.
No JWT required so n8n workflows can call it directly.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import httpx

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings

router = APIRouter(prefix="/api/n8n", tags=["N8N Integration"])


class DigestRequest(BaseModel):
    message: str
    thread_id: str = "n8n-digest"


class DigestResponse(BaseModel):
    reply: str
    thread_id: str


def _verify_api_key(x_n8n_api_key: str = Header(...)) -> None:
    """Validate the API key passed by n8n."""
    if not settings.N8N_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="N8N_API_KEY not configured on server",
        )
    if x_n8n_api_key != settings.N8N_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid N8N API key",
        )


@router.post("/summarize", response_model=DigestResponse)
async def n8n_summarize(request: DigestRequest, x_n8n_api_key: str = Header(...)) -> DigestResponse:
    """
    Called by n8n to summarize articles using the LiteLLM proxy.
    Secured by X-N8N-API-Key header — no JWT needed.
    """
    _verify_api_key(x_n8n_api_key)

    # Call LiteLLM proxy directly (no user session needed)
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.LITELLM_PROXY_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a research digest assistant. "
                            "Summarize the provided articles into a concise, "
                            "well-structured digest suitable for a daily briefing email."
                        ),
                    },
                    {"role": "user", "content": request.message},
                ],
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LiteLLM error: {response.text}",
        )

    data = response.json()
    reply = data["choices"][0]["message"]["content"]

    return DigestResponse(reply=reply, thread_id=request.thread_id)


# ── Quality Analysis endpoint ──────────────────────────────────────────────

class QualityRequest(BaseModel):
    machine_id: str
    defect_type: str
    severity: str                  # "critical" | "high" | "medium" | "low"
    batch_id: str
    unit_count: int
    defective_units: int
    recent_history: list[dict] = []   # injected by n8n from Supabase


class QualityResponse(BaseModel):
    machine_id: str
    batch_id: str
    defect_rate: str
    severity: str
    status: str
    ai_analysis: str


@router.post("/analyze", response_model=QualityResponse)
async def n8n_analyze(request: QualityRequest, x_n8n_api_key: str = Header(...)) -> QualityResponse:
    """
    Called by n8n to perform AI-powered quality analysis on a production defect report.
    Secured by X-N8N-API-Key header — no JWT needed.
    """
    _verify_api_key(x_n8n_api_key)

    defect_rate = round((request.defective_units / request.unit_count) * 100, 2) if request.unit_count > 0 else 0.0

    history_text = ""
    if request.recent_history:
        history_text = "\n".join(
            f"- {r.get('logged_at', 'N/A')}: {r.get('defect_type', '?')} | {r.get('defective_units', 0)}/{r.get('unit_count', 0)} units | severity={r.get('severity', '?')}"
            for r in request.recent_history[:5]
        )
    else:
        history_text = "No recent history found for this machine."

    prompt = (
        f"You are an automobile manufacturing quality control AI.\n\n"
        f"A defect report has been submitted:\n"
        f"- Machine ID: {request.machine_id}\n"
        f"- Batch ID: {request.batch_id}\n"
        f"- Defect Type: {request.defect_type}\n"
        f"- Severity: {request.severity}\n"
        f"- Units Produced: {request.unit_count}\n"
        f"- Defective Units: {request.defective_units}\n"
        f"- Defect Rate: {defect_rate}%\n\n"
        f"Recent defect history for this machine:\n{history_text}\n\n"
        f"Provide: 1) Likely root cause, 2) Immediate corrective actions, 3) Preventive recommendations. "
        f"Be concise and specific to automobile manufacturing."
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.LITELLM_PROXY_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": "You are an expert automobile manufacturing quality control analyst."},
                    {"role": "user", "content": prompt},
                ],
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LiteLLM error: {response.text}",
        )

    data = response.json()
    ai_analysis = data["choices"][0]["message"]["content"]

    status_label = "critical_alert" if request.severity == "critical" or defect_rate > 5 else "within_tolerance"

    return QualityResponse(
        machine_id=request.machine_id,
        batch_id=request.batch_id,
        defect_rate=f"{defect_rate}%",
        severity=request.severity,
        status=status_label,
        ai_analysis=ai_analysis,
    )


# ── Latest digest for frontend notification ────────────────────────────────

class DigestRecord(BaseModel):
    digest_text: str
    run_date: str
    article_count: Optional[int] = None


@router.get("/digest")
async def get_latest_digest(
    current_user: CurrentUser = Depends(get_current_user),
) -> Optional[DigestRecord]:
    """
    Returns the most recent successful AI digest.
    JWT-protected — called by the frontend to show a digest notification.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/digest_history",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            },
            params={
                "select": "digest_text,run_date,article_count",
                "status": "eq.success",
                "order": "run_date.desc",
                "limit": "1",
            },
        )
    if resp.status_code != 200 or not resp.json():
        return None
    row = resp.json()[0]
    return DigestRecord(**row)
