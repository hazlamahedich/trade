import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

logger = logging.getLogger(__name__)


class MockHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle mock headers for testing failure scenarios.

    Headers:
        - X-Mock-Providers-Down: Simulates all external providers being unavailable.
          Backend returns cached data with isStale=true if available.
        - X-Mock-All-Down: Complete failure with cache bypass. Returns 503.
        - X-Mock-No-Cache: Bypasses Redis cache to test fresh data fetching.

    Note: Only enabled in non-production environments.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.ENVIRONMENT or settings.ENVIRONMENT == "production":
            return await call_next(request)

        mock_providers_down = (
            request.headers.get("X-Mock-Providers-Down", "").lower() == "true"
        )
        mock_all_down = request.headers.get("X-Mock-All-Down", "").lower() == "true"
        mock_no_cache = request.headers.get("X-Mock-No-Cache", "").lower() == "true"

        request.state.mock_providers_down = mock_providers_down or mock_all_down
        request.state.mock_all_down = mock_all_down
        request.state.mock_no_cache = mock_no_cache

        return await call_next(request)
