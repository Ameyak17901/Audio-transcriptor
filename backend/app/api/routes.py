import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.services.deepgram import DeepgramService
from app.services.supabase_storage import SupabaseStorageService

router = APIRouter(prefix="/api", tags=["Audio & Storage"])
_start_time = time.time()


class PresignedUploadRequest(BaseModel):
    file_path: str = Field(..., description="Destination path in bucket (e.g. user_recordings/audio_123.webm)")
    content_type: str = Field("audio/webm", description="MIME content type")


class PresignedUploadResponse(BaseModel):
    signed_url: str
    token: Optional[str] = None
    file_path: str
    bucket: str
    expires_in_seconds: int = 900


class SignedDownloadRequest(BaseModel):
    file_path: str = Field(..., description="Path of audio file in Supabase Storage")
    expires_in: int = Field(3600, description="Validity period in seconds")


class SignedDownloadResponse(BaseModel):
    download_url: str
    file_path: str
    expires_in: int


class DeleteAudioRequest(BaseModel):
    file_path: str = Field(..., description="Path of audio file in Supabase Storage to delete")


@router.get("/health")
async def health_check(settings: Settings = Depends(get_settings)):
    """Liveness and readiness probe for container orchestrators and clients."""
    uptime = round(time.time() - _start_time, 2)
    return {
        "status": "healthy",
        "uptime_seconds": uptime,
        "deepgram_configured": bool(settings.deepgram_api_key.strip()),
        "supabase_configured": settings.has_supabase,
        "rag_ready": True,
    }


@router.post("/uploads/presigned-url", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    payload: PresignedUploadRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Vends a time-limited signed upload lease in Supabase Storage.
    Client uploads audio binary directly via HTTP PUT, consuming 0 bytes of RAM on FastAPI.
    """
    storage = SupabaseStorageService()
    result = storage.generate_signed_upload_url(file_path=payload.file_path)
    return PresignedUploadResponse(**result)


@router.post("/uploads/signed-download-url", response_model=SignedDownloadResponse)
async def get_signed_download_url(
    payload: SignedDownloadRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Generates a signed read URL for in-browser playback or Deepgram transcription ingestion.
    """
    storage = SupabaseStorageService()
    url = storage.generate_signed_download_url(file_path=payload.file_path, expires_in=payload.expires_in)
    return SignedDownloadResponse(
        download_url=url,
        file_path=payload.file_path,
        expires_in=payload.expires_in,
    )


@router.delete("/uploads/audio")
async def delete_uploaded_audio(
    payload: DeleteAudioRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Deletes an audio recording file from Supabase Storage bucket.
    """
    storage = SupabaseStorageService()
    success = storage.delete_audio_file(payload.file_path)
    return {"success": success, "file_path": payload.file_path}


@router.post("/transcribe")
async def transcribe_audio_stream(
    request: Request,
    model: str = Query("nova-3", description="Deepgram ASR model to use"),
    smart_format: bool = Query(True, description="Enable automatic formatting"),
    punctuate: bool = Query(True, description="Enable punctuation"),
    language: Optional[str] = Query(None, description="Optional language code (e.g. en)"),
    settings: Settings = Depends(get_settings),
):
    """
    Transcribes audio. Supports two modes:
    1. Direct Supabase Storage URL (Zero-RAM mode via JSON body {"file_path": "..."} or {"audio_url": "..."})
    2. Direct binary audio stream (backward compatible fallback for short audio clips)
    """
    content_type = request.headers.get("content-type", "").lower()
    http_client = getattr(request.app.state, "http_client", None)
    service = DeepgramService(api_key=settings.deepgram_api_key)

    # Mode 1: JSON body with file_path or audio_url
    if "application/json" in content_type:
        body = await request.json()
        audio_url = body.get("audio_url")
        file_path = body.get("file_path")

        if not audio_url and file_path:
            storage = SupabaseStorageService()
            audio_url = storage.generate_signed_download_url(file_path=file_path, expires_in=1800)

        if not audio_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'file_path' or 'audio_url' must be provided in JSON request.",
            )

        return await service.transcribe_url(
            audio_url=audio_url,
            model=model,
            smart_format=smart_format,
            punctuate=punctuate,
            language=language,
            client=http_client,
        )

    # Mode 2: Raw binary audio stream
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

    return await service.transcribe_audio(
        audio_bytes=audio_bytes,
        content_type=content_type or "audio/webm",
        model=model,
        smart_format=smart_format,
        punctuate=punctuate,
        language=language,
        client=http_client,
    )
