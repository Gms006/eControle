import os
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _build_default_database_url() -> str:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5434")
    db = os.getenv("POSTGRES_DB", "econtrole")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "eControle v2 API"
    API_V1_STR: str = "/api/v1"
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    SECRET_KEY: str = "dev-secret-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    RECEITAWS_MIN_INTERVAL_SECONDS: int = 20
    RECEITAWS_RATE_LIMIT_BACKOFF_SECONDS: int = 60
    EMPRESAS_ROOT_DIR: str = "G:/EMPRESAS"

    SEED_ENABLED: bool = True
    SEED_ORG_NAME: str = "Neto Contabilidade"
    MASTER_EMAIL: str = "admin@example.com"
    MASTER_PASSWORD: str = "admin123"
    MASTER_ROLES: str = "DEV,ADMIN"
    
    PORTAL_CIDADAO_USUARIO: str = ""
    PORTAL_CIDADAO_SENHA: str = ""
    API_KEY_2CAPTCHA: str = ""

    TAX_PORTAL_DEFAULT_MUNICIPIO: str = "ANÁPOLIS"
    TAX_PORTAL_MIN_INTERVAL_SECONDS: int = 0
    TAX_PORTAL_MAX_TENTATIVAS: int = 2
    TAX_PORTAL_MODO_TESTE: bool = False
    TAX_PORTAL_MODO_HEADLESS: bool = True
    TAX_PORTAL_EXECUTABLE_PATH: str = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    TAX_PORTAL_MAX_TENTATIVAS_CAPTCHA: int = 3
    
    DATABASE_URL: str = Field(default_factory=_build_default_database_url)
    CERTHUB_WEBHOOK_TOKEN: str = ""
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
    )

    # ------------------------------------------------------------------
    # Agente RFB local (fallback para consulta direta à Receita Federal)
    # ------------------------------------------------------------------
    # URL base do processo rfb_agent.py. Altere RFB_AGENT_PORT no .env
    # se precisar mudar a porta (padrão 8021).
    RFB_AGENT_URL: str = "http://127.0.0.1:8021"
    COPILOT_PROVIDER: str = "gemini"
    COPILOT_PROVIDER_MODEL: str = "gemini-2.5-flash"
    COPILOT_PROVIDER_TIMEOUT_SECONDS: int = 60
    COPILOT_PROVIDER_ENABLE_WEB_SEARCH: bool = True
    GEMINI_API_KEY: str = ""
    COPILOT_FALLBACK_PROVIDER: str = "ollama"
    COPILOT_FALLBACK_BASE_URL: str = "http://127.0.0.1:11434"
    COPILOT_FALLBACK_MODEL: str = "gemma3:4b"
    COPILOT_FALLBACK_TIMEOUT_SECONDS: int = 60

    # campos legados mantidos por compatibilidade; evitar uso novo
    COPILOT_PROVIDER_BASE_URL: str = ""
    COPILOT_PROVIDER_API_KEY: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, value):
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, value, info):
        env = str(info.data.get("ENV", "dev")).lower()
        if env != "dev" and (not value or value == "dev-secret-change-me"):
            raise ValueError("SECRET_KEY must be set in non-dev environments")
        return value

    @field_validator("SEED_ENABLED")
    @classmethod
    def _validate_seed_enabled(cls, value, info):
        env = str(info.data.get("ENV", "dev")).lower()
        if env != "dev" and value:
            raise ValueError("SEED_ENABLED must be false in non-dev environments")
        return value


settings = Settings()
