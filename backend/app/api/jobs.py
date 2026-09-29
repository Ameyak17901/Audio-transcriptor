import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.job_manager import JobProgressEvent, JobStatus, job_manager
from app.services.job_worker import run_transcription_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["Async Jobs & Server-Sent Events (SSE)"])


class TranscribeJobRequest(BaseModel):
    file_path: Optional[str] = Field(None, description="Storage object path in Supabase bucket")
    audio_url: Optional[str] = Field(None, description="Public or signed remote audio URL")
    model: str = Field("nova-3", description="Deepgram ASR model to use")
    smart_format: bool = Field(True, description="Enable automatic formatting")
    punctuate: bool = Field(True, description="Enable punctuation")
    language: Optional[str] = Field(None, description="Optional language code (e.g. en)")


class TranscribeJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int
    message: str
    stream_url: str
    poll_url: str


@router.post(
    "/transcribe",
    response_model=TranscribeJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue async transcription job",
)
async def enqueue_transcription_job(
    payload: TranscribeJobRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Enqueues an asynchronous audio transcription task and immediately returns HTTP 202 Accepted.
    
    The client can connect to the returned `stream_url` using Server-Sent Events (SSE)
    to receive real-time granular progress updates and the final transcript payload.
    """
    if not payload.file_path and not payload.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'file_path' (Supabase Storage) or 'audio_url' must be provided.",
        )

    job = job_manager.create_job(initial_message="Transcription task enqueued in background worker pool")
    http_client = getattr(request.app.state, "http_client", None)

    # Spawn background task processing
    background_tasks.add_task(
        run_transcription_job,
        job_id=job.job_id,
        file_path=payload.file_path,
        audio_url=payload.audio_url,
        model=payload.model,
        smart_format=payload.smart_format,
        punctuate=payload.punctuate,
        language=payload.language,
        http_client=http_client,
    )

    return TranscribeJobResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        message=job.message,
        stream_url=f"/api/jobs/{job.job_id}/stream",
        poll_url=f"/api/jobs/{job.job_id}",
    )


@router.get(
    "/{job_id}",
    response_model=JobProgressEvent,
    summary="Poll job status",
)
async def get_job_status(job_id: str):
    """
    Poll endpoint returning current job state as JSON.
    Acts as a fallback for environments where persistent SSE streaming is disallowed.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcription job '{job_id}' not found.",
        )
    return job


@router.get(
    "/{job_id}/stream",
    summary="Stream real-time job progress via Server-Sent Events (SSE)",
)
async def stream_job_progress(job_id: str, request: Request):
    """
    Server-Sent Events (SSE) endpoint:
    Streams real-time progress events for the given `job_id`.
    
    Event Types:
    - 'progress': Granular pipeline progress (status, percentage, stage, message)
    - 'complete': Emitted once upon successful completion with the full transcript result
    - 'error': Emitted if the background task encountered an unrecoverable failure
    
    Includes 15-second heartbeat ping comments (: ping\\n\\n) to keep HTTP proxies active.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcription job '{job_id}' not found.",
        )

    async def sse_event_generator():
        seq = 0
        try:
            # Create async iterator from job subscription
            async for event in job_manager.subscribe(job_id):
                # Detect client disconnect early
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected from job '{job_id}'")
                    break

                seq += 1
                event_name = "progress"
                if event.status == JobStatus.COMPLETED:
                    event_name = "complete"
                elif event.status == JobStatus.FAILED:
                    event_name = "error"

                data_str = event.model_dump_json()
                # RFC 8895 SSE wire protocol
                yield f"event: {event_name}\nid: {seq}\ndata: {data_str}\n\n"

                if event.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                    break

        except (asyncio.CancelledError, ConnectionResetError):
            logger.info(f"SSE connection closed for job '{job_id}'")
        except Exception as e:
            logger.error(f"Unexpected error in SSE generator for job '{job_id}': {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # Disables proxy buffering in Nginx/Render/Cloudflare
    }

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream", headers=headers)
