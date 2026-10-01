import time
from unittest.mock import MagicMock, patch
import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

JWT_SECRET = "super-secret-test-jwt-key-minimum-32-chars-long"


def create_test_jwt(user_id: str = "user_test_123", email: str = "user@test.com", expires_in: int = 3600) -> str:
    """Helper to generate signed test JWT tokens."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + expires_in,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def mock_test_env(monkeypatch):
    """Ensure tests run in test environment using mock database and test JWT secret."""
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", JWT_SECRET)
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_transcripts_endpoint_requires_auth():
    """Verify /api/transcripts rejects unauthenticated requests with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/transcripts")
    assert resp.status_code == 401
    assert "Missing Bearer authorization token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_transcripts_crud_lifecycle_authenticated():
    """Verify full CRUD flow with valid Supabase JWT Bearer token."""
    token = create_test_jwt(user_id="user_alice_456", email="alice@test.com")
    auth_headers = {"Authorization": f"Bearer {token}"}

    with patch("app.core.auth.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            supabase_jwt_secret=JWT_SECRET,
            supabase_url="",
            supabase_service_role_key="",
            has_supabase=False,
            environment="test",
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create Transcript
            create_payload = {
                "title": "Sprint Planning Meeting",
                "audio_path": "user_recordings/user_alice_456/audio.webm",
                "duration_seconds": 12.5,
                "confidence": 0.96,
                "full_transcript": "We will deliver the Supabase integration this sprint.",
                "model": "nova-3",
                "language": "en",
            }
            create_resp = await client.post("/api/transcripts", json=create_payload, headers=auth_headers)
            assert create_resp.status_code == 201
            item = create_resp.json()
            assert item["user_id"] == "user_alice_456"
            assert item["full_transcript"] == create_payload["full_transcript"]
            transcript_id = item["id"]

            # 2. List Transcripts (Should return created item)
            list_resp = await client.get("/api/transcripts", headers=auth_headers)
            assert list_resp.status_code == 200
            items = list_resp.json()
            assert any(x["id"] == transcript_id for x in items)

            # 3. Get Single Transcript
            get_resp = await client.get(f"/api/transcripts/{transcript_id}", headers=auth_headers)
            assert get_resp.status_code == 200
            assert get_resp.json()["id"] == transcript_id

            # 4. Patch Transcript
            patch_resp = await client.patch(
                f"/api/transcripts/{transcript_id}",
                json={"title": "Sprint Planning Updated", "full_transcript": "Updated meeting notes"},
                headers=auth_headers,
            )
            assert patch_resp.status_code == 200
            assert patch_resp.json()["title"] == "Sprint Planning Updated"
            assert patch_resp.json()["is_edited"] is True

            # 5. Delete Transcript
            del_resp = await client.delete(f"/api/transcripts/{transcript_id}", headers=auth_headers)
            assert del_resp.status_code == 204

            # Verify deletion
            get_after_del = await client.get(f"/api/transcripts/{transcript_id}", headers=auth_headers)
            assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_tenant_isolation_between_users():
    """Verify User B cannot view User A's transcripts."""
    token_user_a = create_test_jwt(user_id="user_tenant_A", email="a@test.com")
    token_user_b = create_test_jwt(user_id="user_tenant_B", email="b@test.com")

    with patch("app.core.auth.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            supabase_jwt_secret=JWT_SECRET,
            supabase_url="",
            supabase_service_role_key="",
            has_supabase=False,
            environment="test",
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # User A creates transcript
            create_resp = await client.post(
                "/api/transcripts",
                json={"title": "Secret A", "full_transcript": "User A secret document"},
                headers={"Authorization": f"Bearer {token_user_a}"},
            )
            item_a_id = create_resp.json()["id"]

            # User B attempts to access User A's transcript directly
            resp_b = await client.get(
                f"/api/transcripts/{item_a_id}",
                headers={"Authorization": f"Bearer {token_user_b}"},
            )
            assert resp_b.status_code == 404

            # User B lists transcripts (should not include User A's items)
            list_b = await client.get(
                "/api/transcripts",
                headers={"Authorization": f"Bearer {token_user_b}"},
            )
            assert not any(x["id"] == item_a_id for x in list_b.json())


@pytest.mark.asyncio
async def test_sync_guest_transcripts():
    """Verify bulk migration of guest localStorage items into database."""
    token = create_test_jwt(user_id="migrated_user_777", email="migrated@test.com")

    with patch("app.core.auth.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            supabase_jwt_secret=JWT_SECRET,
            supabase_url="",
            supabase_service_role_key="",
            has_supabase=False,
            environment="test",
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "items": [
                    {"title": "Guest Recording 1", "full_transcript": "Text 1", "duration_seconds": 5.0},
                    {"title": "Guest Recording 2", "full_transcript": "Text 2", "duration_seconds": 10.0},
                ]
            }
            resp = await client.post(
                "/api/transcripts/sync-guest",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            migrated = resp.json()
            assert len(migrated) == 2
            assert all(x["user_id"] == "migrated_user_777" for x in migrated)
