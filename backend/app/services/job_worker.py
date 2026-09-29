import asyncio
import logging
from typing import Optional
import httpx

from app.config import get_settings
from app.services.deepgram import DeepgramService
from app.services.job_manager import JobStatus, job_manager
from app.services.supabase_storage import SupabaseStorageService

logger = logging.getLogger(__name__)


async def run_transcription_job(
    job_id: str,
    file_path: Optional[str] = None,
    audio_url: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    content_type: str = "audio/webm",
    model: str = "nova-3",
    smart_format: bool = True,
    punctuate: bool = True,
    language: Optional[str] = None,
    http_client: Optional[httpx.AsyncClient] = None,
) -> None:
    """
    Asynchronous background pipeline for long-running transcription tasks.
    Publishes granular step progress (10% -> 35% -> 65% -> 85% -> 100%)
    to active SSE listeners via JobManager.
    """
    settings = get_settings()

    try:
        # Stage 1: Pipeline Initialization
        await job_manager.update_job(
            job_id=job_id,
            progress=10,
            stage="initializing",
            message="Initializing async transcription worker pipeline",
            status=JobStatus.PROCESSING,
        )
        await asyncio.sleep(0.1)  # Allow event loop yield for SSE frame dispatch

        # Stage 2: Audio Source Resolution & Storage Access
        resolved_url = audio_url

        if not resolved_url and file_path:
            await job_manager.update_job(
                job_id=job_id,
                progress=30,
                stage="storage_resolution",
                message="Retrieving secure access lease from Supabase Storage",
                status=JobStatus.PROCESSING,
            )
            storage = SupabaseStorageService()
            resolved_url = storage.generate_signed_download_url(file_path=file_path, expires_in=3600)
            await asyncio.sleep(0.1)

        # Stage 3: Deepgram Acoustic & Language Modeling
        await job_manager.update_job(
            job_id=job_id,
            progress=60,
            stage="acoustic_modeling",
            message=f"Deepgram AI processing speech with model '{model}'",
            status=JobStatus.PROCESSING,
        )

        service = DeepgramService(api_key=settings.deepgram_api_key)

        if resolved_url:
            result = await service.transcribe_url(
                audio_url=resolved_url,
                model=model,
                smart_format=smart_format,
                punctuate=punctuate,
                language=language,
                client=http_client,
            )
        elif audio_bytes:
            result = await service.transcribe_audio(
                audio_bytes=audio_bytes,
                content_type=content_type,
                model=model,
                smart_format=smart_format,
                punctuate=punctuate,
                language=language,
                client=http_client,
            )
        else:
            raise ValueError("No valid audio source (file_path, audio_url, or audio_bytes) provided.")

        # Stage 4: Formatting & Structuring Output
        await job_manager.update_job(
            job_id=job_id,
            progress=85,
            stage="formatting",
            message="Structuring transcript paragraphs and word timestamps",
            status=JobStatus.PROCESSING,
        )
        await asyncio.sleep(0.1)

        # Stage 5: Finalized Completion
        await job_manager.update_job(
            job_id=job_id,
            progress=100,
            stage="completed",
            message="Transcript successfully generated and ready",
            status=JobStatus.COMPLETED,
            result=result,
        )
        logger.info(f"Transcription job '{job_id}' completed successfully")

    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Transcription job '{job_id}' failed: {error_msg}", exc_info=True)
        await job_manager.update_job(
            job_id=job_id,
            progress=100,
            stage="failed",
            message=f"Transcription failed: {error_msg}",
            status=JobStatus.FAILED,
            error=error_msg,
        )
