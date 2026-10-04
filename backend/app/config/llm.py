"""
LLM Provider Configuration
Multi-provider support with automatic failover
"""

from pydantic import BaseModel, Field, AnyHttpUrl
from typing import List, Optional, Dict, Any
from enum import Enum

from .settings import settings


class ProviderType(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    DEEPSEEK = "deepseek"
    MISTRAL = "mistral"
    GROQ = "groq"
    CUSTOM = "custom"


class LLMConfig(BaseModel):
    """Configuration for a single LLM provider"""
    provider: ProviderType
    api_key: Optional[str] = None
    api_url: AnyHttpUrl
    timeout: int = 60
    models: List[str] = []
    enabled: bool = True
    priority: int = 1


class LLMProviderConfig(BaseModel):
    """Complete LLM provider configuration"""
    default_provider: ProviderType = ProviderType.ANTHROPIC
    providers: Dict[ProviderType, LLMConfig] = {}
    failover_enabled: bool = True
    failover_order: List[ProviderType] = [
        ProviderType.ANTHROPIC,
        ProviderType.OPENAI,
        ProviderType.DEEPSEEK,
        ProviderType.MISTRAL,
        ProviderType.GROQ,
        ProviderType.CUSTOM,
    ]


# Create LLM configuration from settings
llm_config = LLMProviderConfig(
    default_provider=ProviderType(settings.DEFAULT_PROVIDER),
    providers={
        ProviderType.ANTHROPIC: LLMConfig(
            provider=ProviderType.ANTHROPIC,
            api_key=settings.ANTHROPIC_API_KEY,
            api_url=settings.ANTHROPIC_API_URL,
            timeout=settings.ANTHROPIC_TIMEOUT,
            models=["claude-3-5-sonnet-20250620", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
            enabled=settings.ANTHROPIC_API_KEY is not None,
            priority=1,
        ),
        ProviderType.OPENAI: LLMConfig(
            provider=ProviderType.OPENAI,
            api_key=settings.OPENAI_API_KEY,
            api_url=settings.OPENAI_API_URL,
            timeout=settings.OPENAI_TIMEOUT,
            models=["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
            enabled=settings.OPENAI_API_KEY is not None,
            priority=2,
        ),
        ProviderType.DEEPSEEK: LLMConfig(
            provider=ProviderType.DEEPSEEK,
            api_key=settings.DEEPSEEK_API_KEY,
            api_url=settings.DEEPSEEK_API_URL,
            timeout=settings.DEEPSEEK_TIMEOUT,
            models=["deepseek-chat", "deepseek-coder"],
            enabled=settings.DEEPSEEK_API_KEY is not None,
            priority=3,
        ),
        ProviderType.MISTRAL: LLMConfig(
            provider=ProviderType.MISTRAL,
            api_key=settings.MISTRAL_API_KEY,
            api_url=settings.MISTRAL_API_URL,
            timeout=settings.MISTRAL_TIMEOUT,
            models=["mistral-large", "mistral-small", "mistral-tiny"],
            enabled=settings.MISTRAL_API_KEY is not None,
            priority=4,
        ),
        ProviderType.GROQ: LLMConfig(
            provider=ProviderType.GROQ,
            api_key=settings.GROQ_API_KEY,
            api_url=settings.GROQ_API_URL,
            timeout=settings.GROQ_TIMEOUT,
            models=["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
            enabled=settings.GROQ_API_KEY is not None,
            priority=5,
        ),
        ProviderType.CUSTOM: LLMConfig(
            provider=ProviderType.CUSTOM,
            api_key=settings.CUSTOM_LLM_API_KEY,
            api_url=settings.CUSTOM_LLM_ENDPOINT or AnyHttpUrl("http://localhost:8000"),
            timeout=60,
            models=["custom"],
            enabled=settings.CUSTOM_LLM_ENDPOINT is not None,
            priority=6,
        ),
    },
)


# Get enabled providers
enabled_providers = [
    p for p in llm_config.failover_order 
    if llm_config.providers.get(p, {}).enabled
]
