import logging

from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings

logger = logging.getLogger(__name__)


class MockHeadersMiddleware:
    """
    Middleware to handle mock headers for testing failure scenarios.

    Headers:
        - X-Mock-Providers-Down: Simulates all external providers being unavailable.
          Backend returns cached data with isStale=true if available.
        - X-Mock-All-Down: Complete failure with cache bypass. Returns 503.
        - X-Mock-No-Cache: Bypasses Redis cache to test fresh data fetching.

    Note: Only enabled in non-production environments.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if not settings.ENVIRONMENT or settings.ENVIRONMENT == "production":
            await self.app(scope, receive, send)
            return

        headers = dict(
            (k.decode().lower(), v.decode()) for k, v in scope.get("headers", [])
        )

        mock_providers_down = headers.get("x-mock-providers-down", "").lower() == "true"
        mock_all_down = headers.get("x-mock-all-down", "").lower() == "true"
        mock_no_cache = headers.get("x-mock-no-cache", "").lower() == "true"

        scope.setdefault("state", {})
        scope["state"]["mock_providers_down"] = mock_providers_down or mock_all_down
        scope["state"]["mock_all_down"] = mock_all_down
        scope["state"]["mock_no_cache"] = mock_no_cache

        await self.app(scope, receive, send)
