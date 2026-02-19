import logging
import re
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi_pagination import add_pagination
from .schemas import UserCreate, UserRead, UserUpdate
from .users import auth_backend, fastapi_users, AUTH_URL_PATH
from fastapi.middleware.cors import CORSMiddleware
from .utils import simple_generate_unique_route_id
from app.routes.items import router as items_router
from app.routes.health import router as health_router
from app.routes.market import router as market_router
from app.routes.debate import router as debate_router
from app.routes.ws import router as ws_router
from app.config import settings
from app.middleware.mock_middleware import MockHeadersMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
)

app.add_middleware(MockHeadersMiddleware)


@app.middleware("http")
async def scrub_token_from_logs(request: Request, call_next: Callable) -> Response:
    token = request.query_params.get("token")
    if token:
        clean_path = re.sub(r"token=[^&]*", "token=[REDACTED]", str(request.url))
        logger.info(f"Request: {request.method} {clean_path}")
    response = await call_next(request)
    return response


# Middleware for CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication and user management routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Include items routes
app.include_router(items_router, prefix="/items")
app.include_router(health_router)
app.include_router(market_router)
app.include_router(debate_router)
app.include_router(ws_router)
add_pagination(app)
