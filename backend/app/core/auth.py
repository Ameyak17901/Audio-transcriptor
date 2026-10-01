import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import get_settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


@dataclass
class AuthenticatedUser:
    """Represents an authenticated Supabase user context."""
    id: str
    email: str = ""
    role: str = "authenticated"
    claims: Dict[str, Any] = field(default_factory=dict)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthenticatedUser:
    """
    Validates the Supabase Bearer JWT from the Authorization header.
    Decodes and verifies cryptographic signature, subject UUID, and expiration.
    Throws HTTP 401 Unauthorized if token is absent, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = credentials.credentials.strip()

    # Strategy 1: Verify using configured SUPABASE_JWT_SECRET (fastest, zero network I/O)
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed token: missing subject user ID.",
                )

            return AuthenticatedUser(
                id=user_id,
                email=payload.get("email", ""),
                role=payload.get("role", "authenticated"),
                claims=payload,
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please refresh your session.",
            )
        except jwt.InvalidTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(exc)}",
            )

    # Strategy 2: If JWT secret is not configured but Supabase client is available, verify via Supabase Auth
    if settings.has_supabase:
        try:
            from supabase import create_client
            client = create_client(settings.supabase_url, settings.supabase_service_role_key)
            user_response = client.auth.get_user(token)
            if user_response and user_response.user:
                u = user_response.user
                return AuthenticatedUser(
                    id=str(u.id),
                    email=u.email or "",
                    role=getattr(u, "role", "authenticated") or "authenticated",
                    claims=getattr(u, "user_metadata", {}) or {},
                )
        except Exception as exc:
            logger.warning(f"Supabase auth verification failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token validation failed against Supabase Auth.",
            )

    # Strategy 3: Development fallback: decode unverified claims if running in development mode
    if settings.environment == "development":
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            user_id = unverified.get("sub") or unverified.get("id") or "dev_user_001"
            return AuthenticatedUser(
                id=user_id,
                email=unverified.get("email", "dev@example.com"),
                role="authenticated",
                claims=unverified,
            )
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Authentication system is not configured. Please set SUPABASE_JWT_SECRET or SUPABASE_URL.",
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[AuthenticatedUser]:
    """
    Extracts authenticated user context when present, but allows guest access
    without raising an HTTP 401 error.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
