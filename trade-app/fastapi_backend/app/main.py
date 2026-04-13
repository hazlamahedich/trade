import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi_pagination import add_pagination
from starlette.exceptions import HTTPException as StarletteHTTPException
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


@asynccontextmanager
async def lifespan(application: FastAPI):
    from app.services.debate.archival_sweeper import sweep_loop

    sweeper_task = asyncio.create_task(sweep_loop())
    logger.info("Archival sweeper started")
    yield
    sweeper_task.cancel()
    try:
        await sweeper_task
    except asyncio.CancelledError:
        pass
    logger.info("Archival sweeper stopped")


app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
    lifespan=lifespan,
)


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    if isinstance(exc.detail, dict) and "data" in exc.detail and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = first.get("loc", [])
    msg = first.get("msg", "Validation error")

    field_name = loc[-1] if loc else "unknown"
    if field_name == "voter_fingerprint":
        error_code = "INVALID_FINGERPRINT"
        message = (
            "voterFingerprint must be a non-empty string between 1 and 128 characters"
        )
    elif field_name == "choice":
        error_code = "INVALID_CHOICE"
        message = msg
    else:
        error_code = "VALIDATION_ERROR"
        message = msg

    return JSONResponse(
        status_code=422,
        content={
            "data": None,
            "error": {"code": error_code, "message": message},
            "meta": {},
        },
    )


app.add_middleware(MockHeadersMiddleware)

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
