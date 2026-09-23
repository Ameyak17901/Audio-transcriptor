from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_health_check():
    """Verify /api/health endpoint returns 200 and healthy status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "uptime_seconds" in data
    assert "deepgram_configured" in data
    assert data["rag_ready"] is True


@pytest.mark.asyncio
async def test_transcribe_rejects_empty_payload():
    """Verify /api/transcribe returns 400 when audio payload is too small."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/transcribe",
            headers={"Content-Type": "audio/webm"},
            content=b"tiny",
        )

    assert response.status_code == 400
    assert "too short or empty" in response.json()["detail"]


@pytest.mark.asyncio
async def test_transcribe_proxies_valid_audio():
    """Verify /api/transcribe successfully proxies valid audio to Deepgram."""
    mock_deepgram_response = {
        "metadata": {"duration": 4.5},
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Hello this is a mocked transcription.",
                            "confidence": 0.99,
                            "words": [{"word": "Hello", "start": 0.1, "end": 0.5}],
                        }
                    ]
                }
            ]
        },
    }

    dummy_audio = b"0" * 1024  # 1KB dummy audio payload

    with patch(
        "app.services.deepgram.DeepgramService.transcribe_audio",
        new_callable=AsyncMock,
        return_value=mock_deepgram_response,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/transcribe?model=nova-3",
                headers={"Content-Type": "audio/webm"},
                content=dummy_audio,
            )

    assert response.status_code == 200
    data = response.json()
    assert data["results"]["channels"][0]["alternatives"][0]["transcript"] == "Hello this is a mocked transcription."


@pytest.mark.asyncio
async def test_rag_ask_endpoint():
    """Verify /api/rag/ask endpoint returns structured response with citations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/rag/ask",
            json={"query": "What was the meeting about?"},
        )

    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "citations" in data
    assert isinstance(data["citations"], list)
    assert data["confidence_score"] > 0


@pytest.mark.asyncio
async def test_rag_index_endpoint():
    """Verify /api/rag/index endpoint accepts transcript data for indexing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/rag/index",
            json={"transcript_id": "tx_test_123", "full_text": "Sample meeting text"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "indexed"
