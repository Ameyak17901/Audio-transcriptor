import asyncio
import json
from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.job_manager import JobManager, JobStatus


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_job_manager_lifecycle():
    """Verify JobManager creates, updates, and completes a job with subscribers."""
    jm = JobManager()
    job = jm.create_job("Starting test job")
    assert job.status == JobStatus.PENDING
    assert job.progress == 0

    events_received = []

    async def _subscriber():
        async for evt in jm.subscribe(job.job_id):
            events_received.append(evt)

    sub_task = asyncio.create_task(_subscriber())
    await asyncio.sleep(0.01)

    # Update progress
    await jm.update_job(
        job_id=job.job_id,
        progress=50,
        stage="processing",
        message="Halfway done",
        status=JobStatus.PROCESSING,
    )
    await asyncio.sleep(0.01)

    # Complete job
    await jm.update_job(
        job_id=job.job_id,
        progress=100,
        stage="completed",
        message="Done",
        status=JobStatus.COMPLETED,
        result={"transcript": "Test audio text"},
    )
    await asyncio.sleep(0.01)
    await sub_task

    assert len(events_received) >= 3
    assert events_received[0].progress == 0
    assert events_received[-1].status == JobStatus.COMPLETED
    assert events_received[-1].result == {"transcript": "Test audio text"}


@pytest.mark.asyncio
async def test_enqueue_job_validation():
    """Verify POST /api/jobs/transcribe rejects requests without file_path or audio_url."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/jobs/transcribe", json={})
    assert resp.status_code == 400
    assert "Either 'file_path'" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_enqueue_job_success():
    """Verify POST /api/jobs/transcribe returns 202 Accepted and job stream URL."""
    transport = ASGITransport(app=app)
    with patch("app.api.jobs.run_transcription_job", new_callable=AsyncMock):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/jobs/transcribe",
                json={"file_path": "recordings/audio_123.webm", "model": "nova-3"},
            )

    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "pending"
    assert data["stream_url"] == f"/api/jobs/{data['job_id']}/stream"
    assert data["poll_url"] == f"/api/jobs/{data['job_id']}"


@pytest.mark.asyncio
async def test_get_job_status_endpoint():
    """Verify GET /api/jobs/{job_id} returns status and 404 for unknown job."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unknown job
        resp_404 = await client.get("/api/jobs/non_existent_id")
        assert resp_404.status_code == 404

        # Enqueue job to get real ID
        with patch("app.api.jobs.run_transcription_job", new_callable=AsyncMock):
            create_resp = await client.post(
                "/api/jobs/transcribe",
                json={"audio_url": "https://example.com/audio.mp3"},
            )
            job_id = create_resp.json()["job_id"]

            resp_200 = await client.get(f"/api/jobs/{job_id}")
            assert resp_200.status_code == 200
            assert resp_200.json()["job_id"] == job_id


@pytest.mark.asyncio
async def test_sse_stream_endpoint():
    """Verify GET /api/jobs/{job_id}/stream streams valid SSE frames with proper headers."""
    from app.services.job_manager import job_manager

    test_job = job_manager.create_job("Stream test initial")
    transport = ASGITransport(app=app)

    async def _simulate_worker():
        await asyncio.sleep(0.05)
        await job_manager.update_job(
            job_id=test_job.job_id,
            progress=50,
            stage="acoustic_modeling",
            message="Model running",
            status=JobStatus.PROCESSING,
        )
        await asyncio.sleep(0.05)
        await job_manager.update_job(
            job_id=test_job.job_id,
            progress=100,
            stage="completed",
            message="Finished",
            status=JobStatus.COMPLETED,
            result={"text": "SSE streaming verified"},
        )

    worker_task = asyncio.create_task(_simulate_worker())

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with client.stream("GET", f"/api/jobs/{test_job.job_id}/stream") as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            assert "no-cache" in response.headers["cache-control"]

            lines = []
            async for line in response.aiter_lines():
                if line:
                    lines.append(line)

    await worker_task

    full_text = "\n".join(lines)
    assert "event: progress" in full_text
    assert "event: complete" in full_text
    assert "SSE streaming verified" in full_text
