import logging
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from supabase import Client, create_client
from app.config import get_settings

logger = logging.getLogger(__name__)


class SupabaseDbService:
    """
    Service for interacting with the Supabase PostgreSQL database.
    Manages persistence of transcripts, profiles, and guest migrations.
    Includes an in-memory mock fallback for tests and offline local development.
    """

    # In-memory store for dev/testing when live Supabase DB is unreachable or in test mode
    _mock_db: Dict[str, Dict[str, Any]] = {}

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        use_mock: Optional[bool] = None,
    ):
        settings = get_settings()
        self.use_mock = (
            use_mock if use_mock is not None else (settings.environment in ("test", "testing"))
        )
        self.url = (supabase_url or settings.supabase_url).strip()
        self.key = (service_role_key or settings.supabase_service_role_key).strip()
        self.is_configured = bool(self.url and self.key) and not self.use_mock

        self._client: Optional[Client] = None
        if self.is_configured:
            try:
                self._client = create_client(self.url, self.key)
            except Exception as e:
                logger.error(f"Failed to initialize Supabase DB client: {e}")
                self.is_configured = False

    @property
    def client(self) -> Client:
        if not self.is_configured or self._client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase Database is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )
        return self._client

    async def list_user_transcripts(
        self,
        user_id: str,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Retrieves paginated transcripts strictly belonging to user_id."""
        if not self.is_configured:
            results = [
                dict(item) for item in self._mock_db.values()
                if item.get("user_id") == user_id
            ]
            if search:
                s_lower = search.lower()
                results = [
                    item for item in results
                    if s_lower in item.get("full_transcript", "").lower()
                    or s_lower in item.get("title", "").lower()
                ]
            results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return results[offset : offset + limit]

        try:
            query = (
                self.client.table("transcripts")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
            )
            if search and search.strip():
                query = query.ilike("full_transcript", f"%{search.strip()}%")

            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Error fetching transcripts for user {user_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database query failed: {str(e)}",
            )

    async def create_transcript(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new transcript record associated with user_id."""
        item_id = str(uuid.uuid4())
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        record = {
            "id": item_id,
            "user_id": user_id,
            "title": data.get("title") or "Untitled Recording",
            "audio_path": data.get("audio_path"),
            "duration_seconds": float(data.get("duration_seconds") or 0.0),
            "confidence": float(data["confidence"]) if data.get("confidence") is not None else None,
            "full_transcript": data.get("full_transcript", ""),
            "model": data.get("model", "nova-3"),
            "language": data.get("language", "en"),
            "is_edited": False,
            "raw_response": data.get("raw_response", {}),
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        if not self.is_configured:
            self._mock_db[item_id] = record
            return record

        try:
            response = self.client.table("transcripts").insert(record).execute()
            if response.data:
                return response.data[0]
            return record
        except Exception as e:
            err_str = str(e)
            # Schema resilience: if confidence column is not yet present on remote DB
            if "confidence" in err_str and "column" in err_str:
                fallback_record = dict(record)
                fallback_record.pop("confidence", None)
                if record.get("confidence") is not None:
                    raw_resp = dict(fallback_record.get("raw_response") or {})
                    raw_resp["confidence"] = record["confidence"]
                    fallback_record["raw_response"] = raw_resp
                try:
                    fallback_resp = self.client.table("transcripts").insert(fallback_record).execute()
                    if fallback_resp.data:
                        result = dict(fallback_resp.data[0])
                        result["confidence"] = record.get("confidence")
                        return result
                except Exception as fallback_err:
                    logger.error(f"Fallback insert also failed: {fallback_err}")

            logger.error(f"Error creating transcript for user {user_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to insert transcript: {str(e)}",
            )

    async def get_transcript(self, transcript_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single transcript by ID with tenant isolation check."""
        if not self.is_configured:
            item = self._mock_db.get(transcript_id)
            if item and item.get("user_id") == user_id:
                return dict(item)
            return None

        try:
            response = (
                self.client.table("transcripts")
                .select("*")
                .eq("id", transcript_id)
                .eq("user_id", user_id)
                .execute()
            )
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching transcript {transcript_id}: {e}")
            return None

    async def update_transcript(
        self,
        transcript_id: str,
        user_id: str,
        title: Optional[str] = None,
        full_transcript: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Updates transcript text and flags is_edited."""
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        updates: Dict[str, Any] = {"updated_at": now_iso}

        if title is not None:
            updates["title"] = title
        if full_transcript is not None:
            updates["full_transcript"] = full_transcript
            updates["is_edited"] = True

        if not self.is_configured:
            item = self._mock_db.get(transcript_id)
            if item and item.get("user_id") == user_id:
                item.update(updates)
                return dict(item)
            return None

        try:
            response = (
                self.client.table("transcripts")
                .update(updates)
                .eq("id", transcript_id)
                .eq("user_id", user_id)
                .execute()
            )
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Error updating transcript {transcript_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update transcript: {str(e)}",
            )

    async def delete_transcript(self, transcript_id: str, user_id: str) -> bool:
        """Deletes a transcript owned by user_id."""
        if not self.is_configured:
            item = self._mock_db.get(transcript_id)
            if item and item.get("user_id") == user_id:
                del self._mock_db[transcript_id]
                return True
            return False

        try:
            response = (
                self.client.table("transcripts")
                .delete()
                .eq("id", transcript_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(response.data)
        except Exception as e:
            logger.error(f"Error deleting transcript {transcript_id}: {e}")
            return False

    async def bulk_create_transcripts(
        self,
        user_id: str,
        items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Batch inserts multiple guest transcripts transferred upon user login."""
        created_list = []
        for item in items:
            created = await self.create_transcript(user_id=user_id, data=item)
            created_list.append(created)
        return created_list
