"""
Application Settings Configuration
Uses Pydantic Settings Management
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AnyHttpUrl
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "SeeControl"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "seecontrol"
    DB_USER: str = "seecontrol"
    DB_PASSWORD: str = "seecontrol123"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    
    # Authentication
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    
    # LLM Providers - BYOK Configuration
    DEFAULT_PROVIDER: str = "anthropic"
    
    # Anthropic
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_API_URL: AnyHttpUrl = "https://api.anthropic.com"
    ANTHROPIC_TIMEOUT: int = 60
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_URL: AnyHttpUrl = "https://api.openai.com"
    OPENAI_TIMEOUT: int = 60
    
    # DeepSeek
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_API_URL: AnyHttpUrl = "https://api.deepseek.com"
    DEEPSEEK_TIMEOUT: int = 60
    
    # Mistral
    MISTRAL_API_KEY: Optional[str] = None
    MISTRAL_API_URL: AnyHttpUrl = "https://api.mistral.ai"
    MISTRAL_TIMEOUT: int = 60
    
    # Groq
    GROQ_API_KEY: Optional[str] = None
    GROQ_API_URL: AnyHttpUrl = "https://api.groq.com"
    GROQ_TIMEOUT: int = 60
    
    # Custom endpoint
    CUSTOM_LLM_ENDPOINT: Optional[AnyHttpUrl] = None
    CUSTOM_LLM_API_KEY: Optional[str] = None
    
    # Orchestration
    MASTER_AI_MODEL: str = "claude-3-5-sonnet-20250620"
    MAX_PARALLEL_AGENTS: int = 4
    TOKEN_BUDGET: int = 50000
    ESCALATION_POLICY: str = "notify_user"
    HEARTBEAT_INTERVAL: int = 1500
    MAX_TASK_RUNTIME_MINUTES: int = 45
    WEB_RESEARCH_LIMIT: int = 50
    FILE_ANALYSIS_LIMIT_MB: int = 100
    
    # WebSocket
    WS_HOST: str = "0.0.0.0"
    WS_PORT: int = 8000
    WS_PING_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 100
    
    # Email (Optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "seecontrol@localhost"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Model configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # Class config for Pydantic v2
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create settings instance
settings = Settings()
