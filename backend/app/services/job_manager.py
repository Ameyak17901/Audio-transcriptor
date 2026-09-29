import asyncio
import logging
import time
import uuid
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobProgressEvent(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100, description="Progress percentage 0-100")
    stage: str = Field(..., description="Machine-readable stage identifier")
    message: str = Field(..., description="Human-readable status message")
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float
    updated_at: float


class JobManager:
    """
    In-memory asynchronous Job Manager & PubSub event broadcaster.
    
    Coordinates asynchronous transcription jobs and streams real-time status 
    updates to one or more Server-Sent Events (SSE) clients via asyncio.Queue.
    Easily pluggable with Redis PubSub / Celery in distributed production environments.
    """

    def __init__(self):
        self._jobs: Dict[str, JobProgressEvent] = {}
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    def create_job(self, initial_message: str = "Job queued for processing") -> JobProgressEvent:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = time.time()
        job = JobProgressEvent(
            job_id=job_id,
            status=JobStatus.PENDING,
            progress=0,
            stage="queued",
            message=initial_message,
            created_at=now,
            updated_at=now,
        )
        self._jobs[job_id] = job
        self._subscribers[job_id] = []
        logger.info(f"Created transcription job '{job_id}'")
        return job

    def get_job(self, job_id: str) -> Optional[JobProgressEvent]:
        return self._jobs.get(job_id)

    async def update_job(
        self,
        job_id: str,
        progress: int,
        stage: str,
        message: str,
        status: JobStatus = JobStatus.PROCESSING,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Optional[JobProgressEvent]:
        """
        Updates job state and broadcasts the new event to all active SSE subscribers.
        """
        job = self._jobs.get(job_id)
        if not job:
            logger.warning(f"Attempted to update non-existent job '{job_id}'")
            return None

        now = time.time()
        updated_job = JobProgressEvent(
            job_id=job_id,
            status=status,
            progress=max(0, min(100, progress)),
            stage=stage,
            message=message,
            result=result if result is not None else job.result,
            error=error if error is not None else job.error,
            created_at=job.created_at,
            updated_at=now,
        )
        self._jobs[job_id] = updated_job

        # Broadcast to all active SSE listener queues for this job
        queues = self._subscribers.get(job_id, [])
        for q in list(queues):
            try:
                q.put_nowait(updated_job)
            except asyncio.QueueFull:
                logger.warning(f"Subscriber queue for job '{job_id}' is full, dropping frame")

        return updated_job

    async def subscribe(self, job_id: str) -> AsyncGenerator[JobProgressEvent, None]:
        """
        Subscribes to real-time events for a job.
        Yields the current state immediately, then yields subsequent updates
        until the job completes, fails, or the client disconnects.
        """
        job = self.get_job(job_id)
        if not job:
            return

        queue: asyncio.Queue[JobProgressEvent] = asyncio.Queue(maxsize=100)
        
        async with self._lock:
            if job_id not in self._subscribers:
                self._subscribers[job_id] = []
            self._subscribers[job_id].append(queue)

        try:
            # First, send current state to client
            yield job

            # If already terminated, return immediately
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                return

            while True:
                # Wait for next broadcast update
                event = await queue.get()
                yield event
                queue.task_done()

                # If job reached terminal state, finish SSE stream
                if event.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                    break
        finally:
            async with self._lock:
                if job_id in self._subscribers and queue in self._subscribers[job_id]:
                    self._subscribers[job_id].remove(queue)
                    if not self._subscribers[job_id] and job and job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                        # Clean up subscribers list
                        self._subscribers.pop(job_id, None)

    async def cleanup_old_jobs(self, max_age_seconds: int = 7200) -> int:
        """Evicts completed or failed jobs older than max_age_seconds to prevent memory growth."""
        now = time.time()
        to_delete = []
        for jid, job in self._jobs.items():
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                if now - job.updated_at > max_age_seconds:
                    to_delete.append(jid)

        for jid in to_delete:
            self._jobs.pop(jid, None)
            self._subscribers.pop(jid, None)

        if to_delete:
            logger.info(f"Evicted {len(to_delete)} stale transcription jobs from memory")
        return len(to_delete)


# Singleton instance across application
job_manager = JobManager()
