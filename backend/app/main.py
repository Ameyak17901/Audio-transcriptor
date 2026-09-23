from contextlib import asynccontextmanager
from pathlib import Path
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.rag import router as rag_router
from app.api.routes import router as api_router
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle:
    Initializes a persistent HTTP connection pool on startup and cleanly closes it on shutdown.
    """
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=100)
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        app.state.http_client = client
        yield


app = FastAPI(
    title="AudioScribe AI Studio Backend",
    description="High-performance async FastAPI backend proxy for Deepgram Speech-to-Text with future RAG support.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_router)
app.include_router(rag_router)

# Production Static Files & Single-Page Application (SPA) Serving
dist_path = Path(__file__).resolve().parent.parent.parent / "dist"

if dist_path.exists() and dist_path.is_dir():
    # Mount assets folder
    assets_path = dist_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # Serve index.html for root and SPA routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return None

        file_path = dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        index_file = dist_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

        return {"message": "AudioScribe AI Backend API is running. Build frontend dist/ to serve UI."}
else:
    @app.get("/")
    async def root_dev():
        return {
            "service": "AudioScribe AI Backend API",
            "status": "running",
            "docs": "/docs",
            "health": "/api/health",
        }
