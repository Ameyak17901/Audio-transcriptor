import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from app.config import Settings, get_settings
from app.services.deepgram import DeepgramService

router = APIRouter(prefix="/api", tags=["Audio & Health"])
_start_time = time.time()


@router.get("/health")
async def health_check(settings: Settings = Depends(get_settings)):
    """Liveness and readiness probe for container orchestrators."""
    uptime = round(time.time() - _start_time, 2)
    return {
        "status": "healthy",
        "uptime_seconds": uptime,
        "deepgram_configured": bool(settings.deepgram_api_key.strip()),
        "rag_ready": True,
    }


@router.post("/transcribe")
async def transcribe_audio_stream(
    request: Request,
    model: str = Query("nova-3", description="Deepgram ASR model to use"),
    smart_format: bool = Query(True, description="Enable automatic formatting"),
    punctuate: bool = Query(True, description="Enable punctuation"),
    language: str | None = Query(None, description="Optional language code (e.g. en)"),
    settings: Settings = Depends(get_settings),
):
    """
    Accepts raw binary audio streams or audio blobs from the browser,
    validates the payload size, and proxies directly to Deepgram Speech-to-Text.
    """
    # 1. Validate content type
    content_type = request.headers.get("content-type", "audio/webm")

    # 2. Read audio payload stream
    audio_bytes = await request.body()
    max_bytes = settings.max_payload_mb * 1024 * 1024

    if not audio_bytes or len(audio_bytes) < 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio payload is too short or empty. Please record at least 1-2 seconds of speech.",
        )

    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio payload size ({round(len(audio_bytes) / 1024 / 1024, 2)}MB) exceeds maximum limit of {settings.max_payload_mb}MB.",
        )

    # 3. Transcribe via Deepgram Service
    service = DeepgramService(api_key=settings.deepgram_api_key)
    http_client = getattr(request.app.state, "http_client", None)
    result = await service.transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=content_type,
        model=model,
        smart_format=smart_format,
        punctuate=punctuate,
        language=language,
        client=http_client,
    )

    return result
