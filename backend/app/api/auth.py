"""Auth router — /api/auth/*"""
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse

from app.core.auth import CurrentUser, create_access_token, get_current_user
from app.core.config import settings
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Auth"])

_COOKIE_OPTS: dict = {
    "key": "access_token",
    "httponly": True,
    "samesite": "lax",
    "secure": False,
    "max_age": settings.JWT_EXPIRE_MINUTES * 60,
}


def _set_auth_cookie(response: Response, user_id: uuid.UUID, email: str) -> None:
    token = create_access_token(user_id, email)
    response.set_cookie(value=token, **_COOKIE_OPTS)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response) -> UserResponse:
    if auth_service.get_by_email(body.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "email_taken", "message": "Email already registered"},
        )
    user = auth_service.register(body.email, body.password, body.display_name)
    _set_auth_cookie(response, user.id, user.email)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, response: Response) -> UserResponse:
    user = auth_service.authenticate(body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "Invalid email or password"},
        )
    _set_auth_cookie(response, user.id, user.email)
    return UserResponse.model_validate(user)


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> UserResponse:
    user = auth_service.get_by_id(current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "User not found"},
        )
    return UserResponse.model_validate(user)


@router.get("/google/login")
async def google_login() -> dict:
    params = urlencode(
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/google/callback")
async def google_callback(code: str) -> RedirectResponse:
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        tokens = token_res.json()
        access = tokens.get("access_token")
        if not access:
            raise HTTPException(status_code=400, detail={"error": "oauth_failed", "message": "Google token exchange failed"})

        info_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access}"},
        )
        info = info_res.json()

    email: str = info.get("email", "")
    google_id: str = info.get("sub", "")
    display_name: str | None = info.get("name")
    avatar_url: str | None = info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail={"error": "oauth_failed", "message": "Could not retrieve email from Google"})

    # Enforce organisation email domain
    allowed = [d.strip() for d in settings.ALLOWED_EMAIL_DOMAINS.split(",")]
    if not any(email.lower().endswith(f"@{d}") for d in allowed):
        domains_str = " or ".join(f"@{d}" for d in allowed)
        from urllib.parse import quote
        redirect_err = RedirectResponse(
            url=f"http://localhost:5173/?auth_error={quote(f'Only {domains_str} accounts are permitted')}",
            status_code=302,
        )
        return redirect_err

    user = auth_service.get_by_email(email)
    if not user:
        # New user — create via Google
        user = auth_service.create_google_user(email, google_id, display_name, avatar_url)
    elif not user.google_id:
        # Existing email/password account — link Google identity
        auth_service.link_google_id(user.id, google_id, avatar_url)

    token = create_access_token(user.id, user.email)
    redirect = RedirectResponse(url="http://localhost:5173/", status_code=302)
    redirect.set_cookie(value=token, **_COOKIE_OPTS)
    return redirect
