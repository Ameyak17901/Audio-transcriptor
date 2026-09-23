import httpx
from fastapi import HTTPException, status
from app.config import get_settings


class DeepgramService:
    """Service to proxy audio transcription requests to Deepgram API."""

    def __init__(self, api_key: str | None = None):
        settings = get_settings()
        self.api_key = (api_key or settings.deepgram_api_key).strip()
        self.base_url = "https://api.deepgram.com/v1/listen"

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        content_type: str = "audio/webm",
        model: str = "nova-3",
        smart_format: bool = True,
        punctuate: bool = True,
        language: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> dict:
        """
        Transcribe raw audio bytes using Deepgram Speech-to-Text API.
        Reuses an injected persistent httpx.AsyncClient pool if available.
        """
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Deepgram API key is not configured on the server.",
            )

        if not audio_bytes or len(audio_bytes) < 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio payload is too short or empty. Please record at least 1-2 seconds of speech.",
            )

        params: dict[str, str | bool] = {
            "model": model,
            "smart_format": smart_format,
            "punctuate": punctuate,
        }
        if language:
            params["language"] = language

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
            "Accept": "application/json",
        }

        # Helper to execute the HTTP request
        async def _execute_post(http_client: httpx.AsyncClient) -> httpx.Response:
            try:
                return await http_client.post(
                    self.base_url,
                    params=params,
                    headers=headers,
                    content=audio_bytes,
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error communicating with Deepgram upstream: {str(exc)}",
                ) from exc

        if client is not None:
            response = await _execute_post(client)
        else:
            async with httpx.AsyncClient(timeout=60.0) as fallback_client:
                response = await _execute_post(fallback_client)

        if response.status_code != status.HTTP_200_OK:
            try:
                error_body = response.json()
                detail = error_body.get("err_msg") or error_body.get("message") or response.text
            except Exception:
                detail = response.text

            raise HTTPException(
                status_code=response.status_code,
                detail=f"Deepgram upstream error ({response.status_code}): {detail}",
            )

        return response.json()
