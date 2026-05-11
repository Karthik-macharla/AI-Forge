from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.api import health, chat, auth, threads, attachments, images, videos, rag

setup_logging()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Convert Pydantic 422 validation errors to the standard {error, message} shape."""
    first = exc.errors()[0] if exc.errors() else {}
    # Strip the "Value error, " prefix Pydantic v2 prepends
    msg = first.get("msg", "Validation error")
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return JSONResponse(
        status_code=422,
        content={"detail": {"error": "validation_error", "message": msg}},
    )

# CORS — allow local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(threads.router)
app.include_router(chat.router)
app.include_router(attachments.router)
app.include_router(images.router)
app.include_router(videos.router)
app.include_router(rag.router)


@app.get("/")
async def root() -> dict:
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}
