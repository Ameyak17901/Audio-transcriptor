from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.supabase_storage import SupabaseStorageService


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_supabase_storage_service_init_unconfigured():
    """Verify SupabaseStorageService handles missing credentials gracefully."""
    with patch("app.services.supabase_storage.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            supabase_url="",
            supabase_service_role_key="",
            supabase_bucket="audio-recordings",
        )
        service = SupabaseStorageService()
        assert service.is_configured is False
        with pytest.raises(HTTPException) as exc_info:
            _ = service.client
        assert exc_info.value.status_code == 503


def test_supabase_storage_service_generate_signed_upload_url():
    """Verify generate_signed_upload_url requests signed upload URL from Supabase client."""
    with patch("app.services.supabase_storage.create_client") as mock_create_client:
        mock_client = MagicMock()
        mock_storage = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.create_signed_upload_url.return_value = {
            "signedUrl": "https://supabase.co/storage/v1/upload/sign/audio-recordings/test.webm?token=xyz",
            "token": "xyz",
        }
        mock_storage.from_.return_value = mock_bucket
        mock_client.storage = mock_storage
        mock_create_client.return_value = mock_client

        service = SupabaseStorageService(
            supabase_url="https://xyz.supabase.co",
            service_role_key="secret-service-role-key",
            bucket="audio-recordings",
        )

        res = service.generate_signed_upload_url("user_recordings/test.webm")
        assert res["signed_url"].startswith("https://supabase.co")
        assert res["file_path"] == "user_recordings/test.webm"
        assert res["bucket"] == "audio-recordings"
        mock_bucket.create_signed_upload_url.assert_called_once_with("user_recordings/test.webm")


def test_supabase_storage_service_generate_signed_download_url():
    """Verify generate_signed_download_url requests signed read URL from Supabase client."""
    with patch("app.services.supabase_storage.create_client") as mock_create_client:
        mock_client = MagicMock()
        mock_storage = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.create_signed_url.return_value = {
            "signedUrl": "https://supabase.co/storage/v1/object/sign/audio-recordings/test.webm?token=abc"
        }
        mock_storage.from_.return_value = mock_bucket
        mock_client.storage = mock_storage
        mock_create_client.return_value = mock_client

        service = SupabaseStorageService(
            supabase_url="https://xyz.supabase.co",
            service_role_key="secret-service-role-key",
            bucket="audio-recordings",
        )

        url = service.generate_signed_download_url("user_recordings/test.webm", expires_in=1800)
        assert url.startswith("https://supabase.co")
        mock_bucket.create_signed_url.assert_called_once_with(
            path="user_recordings/test.webm",
            expires_in=1800,
        )


@pytest.mark.asyncio
async def test_endpoint_presigned_upload_url():
    """Verify POST /api/uploads/presigned-url returns lease."""
    mock_lease = {
        "signed_url": "https://supabase.co/storage/upload?token=123",
        "token": "123",
        "file_path": "recordings/audio.webm",
        "bucket": "audio-recordings",
        "expires_in_seconds": 900,
    }

    with patch(
        "app.services.supabase_storage.SupabaseStorageService.generate_signed_upload_url",
        return_value=mock_lease,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/uploads/presigned-url",
                json={"file_path": "recordings/audio.webm", "content_type": "audio/webm"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["signed_url"] == mock_lease["signed_url"]
    assert data["file_path"] == "recordings/audio.webm"
    assert data["bucket"] == "audio-recordings"


@pytest.mark.asyncio
async def test_endpoint_signed_download_url():
    """Verify POST /api/uploads/signed-download-url returns read URL."""
    with patch(
        "app.services.supabase_storage.SupabaseStorageService.generate_signed_download_url",
        return_value="https://supabase.co/storage/download?token=456",
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/uploads/signed-download-url",
                json={"file_path": "recordings/audio.webm", "expires_in": 3600},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["download_url"] == "https://supabase.co/storage/download?token=456"
    assert data["file_path"] == "recordings/audio.webm"


@pytest.mark.asyncio
async def test_transcribe_zero_ram_storage_json_endpoint():
    """Verify POST /api/transcribe with JSON file_path uses Supabase download URL and transcribe_url."""
    mock_dg_response = {
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Storage transcription successful.",
                            "confidence": 0.99,
                            "words": [{"word": "Storage", "start": 0.0, "end": 0.4}],
                        }
                    ]
                }
            ]
        }
    }

    with patch(
        "app.services.supabase_storage.SupabaseStorageService.generate_signed_download_url",
        return_value="https://supabase.co/download/signed_audio.webm",
    ), patch(
        "app.services.deepgram.DeepgramService.transcribe_url",
        new_callable=AsyncMock,
        return_value=mock_dg_response,
    ) as mock_transcribe_url:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/transcribe?model=nova-3",
                json={"file_path": "user_recordings/test_meeting.webm"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["results"]["channels"][0]["alternatives"][0]["transcript"] == "Storage transcription successful."
    mock_transcribe_url.assert_called_once()
    assert mock_transcribe_url.call_args[1]["audio_url"] == "https://supabase.co/download/signed_audio.webm"
