import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, get_current_user
from app.services.supabase_db import SupabaseDbService
from app.services.supabase_storage import SupabaseStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcripts", tags=["Transcripts Persistence & Cloud Sync"])


class TranscriptCreate(BaseModel):
    title: Optional[str] = Field("Untitled Recording", description="Title or label for recording")
    audio_path: Optional[str] = Field(None, description="Supabase Storage path (user_recordings/...)")
    duration_seconds: float = Field(0.0, ge=0.0, description="Duration of audio recording in seconds")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Deepgram transcription confidence")
    full_transcript: str = Field(..., min_length=1, description="Complete transcript text")
    model: str = Field("nova-3", description="ASR model used")
    language: Optional[str] = Field("en", description="Detected or configured language")
    raw_response: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Full Deepgram API JSON payload")


class TranscriptUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Updated title")
    full_transcript: Optional[str] = Field(None, description="Updated transcript text")


class TranscriptOut(BaseModel):
    id: str
    user_id: str
    title: str
    audio_path: Optional[str] = None
    duration_seconds: float
    confidence: Optional[float] = None
    full_transcript: str
    model: str
    language: str
    is_edited: bool
    raw_response: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class GuestSyncRequest(BaseModel):
    items: List[TranscriptCreate] = Field(..., description="List of guest transcripts from localStorage to migrate")


@router.get("", response_model=List[TranscriptOut])
async def list_transcripts(
    user: AuthenticatedUser = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Search keyword in transcripts or title"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of items to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """
    Retrieves all transcripts belonging to the authenticated user from Supabase PostgreSQL.
    Enforces complete multi-tenant tenant isolation.
    """
    db = SupabaseDbService()
    return await db.list_user_transcripts(user_id=user.id, search=search, limit=limit, offset=offset)


@router.post("", response_model=TranscriptOut, status_code=status.HTTP_201_CREATED)
async def create_transcript(
    payload: TranscriptCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Saves a new transcript in Supabase PostgreSQL, permanently linked to user.id.
    """
    db = SupabaseDbService()
    created = await db.create_transcript(user_id=user.id, data=payload.model_dump())
    return created


@router.get("/{transcript_id}", response_model=TranscriptOut)
async def get_transcript(
    transcript_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Fetches a single transcript by ID. Verifies user ownership.
    """
    db = SupabaseDbService()
    item = await db.get_transcript(transcript_id=transcript_id, user_id=user.id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcript '{transcript_id}' not found or access denied.",
        )
    return item


@router.patch("/{transcript_id}", response_model=TranscriptOut)
async def update_transcript(
    transcript_id: str,
    payload: TranscriptUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Updates the title or transcript text of an existing record and marks it as edited.
    """
    db = SupabaseDbService()
    updated = await db.update_transcript(
        transcript_id=transcript_id,
        user_id=user.id,
        title=payload.title,
        full_transcript=payload.full_transcript,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcript '{transcript_id}' not found or unauthorized.",
        )
    return updated


@router.delete("/{transcript_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transcript(
    transcript_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Deletes a transcript record from PostgreSQL and removes the associated audio file from Supabase Storage.
    """
    db = SupabaseDbService()
    storage = SupabaseStorageService()

    # 1. Fetch record to get storage audio_path
    item = await db.get_transcript(transcript_id=transcript_id, user_id=user.id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transcript '{transcript_id}' not found.",
        )

    # 2. Delete database record
    await db.delete_transcript(transcript_id=transcript_id, user_id=user.id)

    # 3. Clean up audio file from Supabase Storage if present
    if item.get("audio_path"):
        try:
            storage.delete_audio_file(item["audio_path"])
        except Exception as e:
            logger.warning(f"Failed to delete audio file '{item['audio_path']}': {e}")

    return None


@router.post("/sync-guest", response_model=List[TranscriptOut])
async def sync_guest_transcripts(
    payload: GuestSyncRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Bulk-migrates offline or guest transcripts from browser localStorage
    into Supabase PostgreSQL upon initial user sign-up or sign-in.
    """
    db = SupabaseDbService()
    items_data = [item.model_dump() for item in payload.items]
    migrated = await db.bulk_create_transcripts(user_id=user.id, items=items_data)
    logger.info(f"Migrated {len(migrated)} guest transcripts to user {user.id}")
    return migrated
