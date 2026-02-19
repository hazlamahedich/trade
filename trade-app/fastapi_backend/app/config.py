from typing import Set

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # OpenAPI docs
    OPENAPI_URL: str = "/openapi.json"

    # Database
    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None
    EXPIRE_ON_COMMIT: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # User
    ACCESS_SECRET_KEY: str
    RESET_PASSWORD_SECRET_KEY: str
    VERIFICATION_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600

    # Fixed QA Token for E2E WebSocket tests (non-production only)
    FIXED_QA_TOKEN: str | None = None

    # Email
    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = None
    MAIL_SERVER: str | None = None
    MAIL_PORT: int | None = None
    MAIL_FROM_NAME: str = "FastAPI template"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    TEMPLATE_DIR: str = "email_templates"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # CORS
    CORS_ORIGINS: Set[str]

    # Environment
    ENVIRONMENT: str = "development"

    # LLM Configuration
    openai_api_key: str = ""
    debate_max_turns: int = 6
    debate_llm_model: str = "gpt-4o-mini"
    debate_llm_temperature: float = 0.7

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    def validate_llm_config(self) -> None:
        """Validate LLM configuration at startup.

        Raises:
            ValueError: If required LLM settings are missing in production.
        """
        if not self.openai_api_key and self.ENVIRONMENT != "test":
            raise ValueError(
                "openai_api_key is required for debate engine. "
                "Set OPENAI_API_KEY environment variable."
            )


settings = Settings()
