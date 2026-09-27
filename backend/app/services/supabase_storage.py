import logging
from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from supabase import create_client, Client
from app.config import get_settings

logger = logging.getLogger(__name__)


class SupabaseStorageService:
    """
    Production-grade Supabase Storage integration for audio binary handling.
    
    Generates time-limited signed upload leases so clients stream audio directly
    to Supabase Cloud Storage, reducing FastAPI server memory footprint to 0 bytes.
    Also generates signed download URLs for Deepgram speech-to-text ingestion
    and synced client-side playback.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        bucket: Optional[str] = None,
    ):
        settings = get_settings()
        self.url = (supabase_url or settings.supabase_url).strip()
        self.key = (service_role_key or settings.supabase_service_role_key).strip()
        self.bucket = (bucket or settings.supabase_bucket).strip() or "audio-recordings"
        self.is_configured = bool(self.url and self.key)

        self._client: Optional[Client] = None
        if self.is_configured:
            try:
                self._client = create_client(self.url, self.key)
                logger.info(f"SupabaseStorageService initialized successfully for bucket '{self.bucket}'.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.is_configured = False

    @property
    def client(self) -> Client:
        if not self.is_configured or self._client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase Storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )
        return self._client

    def generate_signed_upload_url(self, file_path: str) -> Dict[str, Any]:
        """
        Creates a time-limited signed upload lease in Supabase Storage.
        The client browser uploads audio directly via HTTP PUT using this URL.
        """
        clean_path = file_path.strip().lstrip("/")
        try:
            response = self.client.storage.from_(self.bucket).create_signed_upload_url(clean_path)
            signed_url = response.get("signedUrl") or response.get("signed_url") or response.get("url")
            token = response.get("token")

            if not signed_url:
                raise ValueError("Supabase did not return a signed upload URL.")

            return {
                "signed_url": signed_url,
                "token": token,
                "file_path": clean_path,
                "bucket": self.bucket,
                "expires_in_seconds": 900,  # 15 minutes lease
            }
        except Exception as e:
            logger.error(f"Failed to generate signed upload URL for '{clean_path}': {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate Supabase signed upload lease: {str(e)}",
            )

    def generate_signed_download_url(self, file_path: str, expires_in: int = 3600) -> str:
        """
        Generates a temporary signed read URL for in-browser playback
        and for passing to Deepgram for direct URL-based speech transcription.
        """
        clean_path = file_path.strip().lstrip("/")
        try:
            response = self.client.storage.from_(self.bucket).create_signed_url(
                path=clean_path,
                expires_in=expires_in,
            )
            download_url = response.get("signedUrl") or response.get("signed_url") or response.get("url")
            if not download_url:
                raise ValueError("Supabase did not return a signed download URL.")
            return download_url
        except Exception as e:
            logger.error(f"Failed to generate signed download URL for '{clean_path}': {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate Supabase streaming URL: {str(e)}",
            )

    def delete_audio_file(self, file_path: str) -> bool:
        """
        Removes an audio file from the Supabase Storage bucket.
        Called when a user deletes a transcript from their history.
        """
        clean_path = file_path.strip().lstrip("/")
        try:
            res = self.client.storage.from_(self.bucket).remove([clean_path])
            return bool(res)
        except Exception as e:
            logger.warning(f"Error deleting file '{clean_path}' from Supabase Storage: {e}")
            return False
