"""Pydantic schemas for auth endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.core.config import settings


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def email_must_be_org_domain(cls, v: str) -> str:
        allowed = [d.strip() for d in settings.ALLOWED_EMAIL_DOMAINS.split(",")]
        if not any(v.lower().endswith(f"@{d}") for d in allowed):
            domains = " or ".join(f"@{d}" for d in allowed)
            raise ValueError(f"Only {domains} email addresses are permitted")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    created_at: datetime
