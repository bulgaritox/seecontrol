"""
LLM Provider Configuration
Multi-provider support with automatic failover
"""

from pydantic import BaseModel, Field, AnyHttpUrl
from typing import List, Optional, Dict, Any
from enum import Enum

from .settings import settings


def has_key(value: Optional[str]) -> bool:
    """True solo si la API key es real (no vacía, no placeholder del .env.example)."""
    if not value:
        return False
    v = value.strip().lower()
    if len(v) < 8:
        return False
    # placeholders típicos del template
    bad = ("your-api-key", "tu-api-key", "sk-ant-your", "sk-your", "change", "aqui", "here")
    return not any(b in v for b in bad)


class ProviderType(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    DEEPSEEK = "deepseek"
    MISTRAL = "mistral"
    GEMINI = "gemini"
    GROQ = "groq"
    OPENROUTER = "openrouter"
    NVIDIA = "nvidia"
    CLOUDFLARE = "cloudflare"
    VERCEL = "vercel"
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
    label: str = ""  # nombre legible para la UI
    note: str = ""   # nota breve (p. ej. "requiere créditos")


class LLMProviderConfig(BaseModel):
    """Complete LLM provider configuration"""
    default_provider: ProviderType = ProviderType.ANTHROPIC
    providers: Dict[ProviderType, LLMConfig] = {}
    failover_enabled: bool = True
    failover_order: List[ProviderType] = [
        ProviderType.GROQ,
        ProviderType.OPENROUTER,
        ProviderType.NVIDIA,
        ProviderType.CLOUDFLARE,
        ProviderType.VERCEL,
        ProviderType.MISTRAL,
        ProviderType.DEEPSEEK,
        ProviderType.ANTHROPIC,
        ProviderType.OPENAI,
        ProviderType.GEMINI,
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
            enabled=has_key(settings.ANTHROPIC_API_KEY),
            priority=1,
            label="Anthropic",
        ),
        ProviderType.OPENAI: LLMConfig(
            provider=ProviderType.OPENAI,
            api_key=settings.OPENAI_API_KEY,
            api_url=settings.OPENAI_API_URL,
            timeout=settings.OPENAI_TIMEOUT,
            models=["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
            enabled=has_key(settings.OPENAI_API_KEY),
            priority=2,
            label="OpenAI",
        ),
        ProviderType.DEEPSEEK: LLMConfig(
            provider=ProviderType.DEEPSEEK,
            api_key=settings.DEEPSEEK_API_KEY,
            api_url=settings.DEEPSEEK_API_URL,
            timeout=settings.DEEPSEEK_TIMEOUT,
            models=["deepseek-chat", "deepseek-coder"],
            enabled=has_key(settings.DEEPSEEK_API_KEY),
            priority=3,
            label="DeepSeek",
        ),
        ProviderType.MISTRAL: LLMConfig(
            provider=ProviderType.MISTRAL,
            api_key=settings.MISTRAL_API_KEY,
            api_url=settings.MISTRAL_API_URL,
            timeout=settings.MISTRAL_TIMEOUT,
            # Verificado funcionando (nov 2026): ministral-3b-latest.
            models=["ministral-3b-latest", "mistral-small-latest", "mistral-large-latest"],
            enabled=has_key(settings.MISTRAL_API_KEY),
            priority=4,
            label="Mistral", note="Verificado: ministral-3b",
        ),
        ProviderType.GROQ: LLMConfig(
            provider=ProviderType.GROQ,
            api_key=settings.GROQ_API_KEY,
            api_url=settings.GROQ_API_URL,
            timeout=settings.GROQ_TIMEOUT,
            # Verificado funcionando (nov 2026): openai/gpt-oss-20b.
            models=["openai/gpt-oss-20b", "openai/gpt-oss-120b"],
            enabled=has_key(settings.GROQ_API_KEY),
            priority=5,
            label="Groq", note="Inferencia ultrarápida",
        ),
        ProviderType.OPENROUTER: LLMConfig(
            provider=ProviderType.OPENROUTER,
            api_key=settings.OPENROUTER_API_KEY,
            api_url=settings.OPENROUTER_API_URL,
            timeout=settings.OPENROUTER_TIMEOUT,
            # El tier gratuito de OpenRouter cambia seguido; estos requieren créditos.
            models=["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "qwen/qwen3-32b"],
            enabled=has_key(settings.OPENROUTER_API_KEY),
            priority=2,
            label="OpenRouter", note="El tier gratuito requiere créditos actualmente",
        ),
        ProviderType.NVIDIA: LLMConfig(
            provider=ProviderType.NVIDIA,
            api_key=settings.NVIDIA_API_KEY,
            api_url=settings.NVIDIA_API_URL,
            timeout=settings.NVIDIA_TIMEOUT,
            # Verificado funcionando (nov 2026): llama-3.2-11b-vision-instruct.
            models=["meta/llama-3.2-11b-vision-instruct", "meta/llama-3.2-90b-vision-instruct"],
            enabled=has_key(settings.NVIDIA_API_KEY),
            priority=3,
            label="NVIDIA NIM", note="Verificado: llama-3.2-11b",
        ),
        ProviderType.CLOUDFLARE: LLMConfig(
            provider=ProviderType.CLOUDFLARE,
            api_key=settings.CLOUDFLARE_API_KEY,
            api_url=settings.CLOUDFLARE_API_URL or AnyHttpUrl("https://api.cloudflare.com"),
            timeout=settings.CLOUDFLARE_TIMEOUT,
            # Verificados funcionando (nov 2026).
            models=[
                "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                "@cf/meta/llama-3.2-3b-instruct",
                "@cf/mistralai/mistral-small-3.1-24b-instruct",
            ],
            enabled=has_key(settings.CLOUDFLARE_API_KEY) and settings.CLOUDFLARE_API_URL is not None,
            priority=4,
            label="Cloudflare Workers AI", note="Verificado",
        ),
        ProviderType.VERCEL: LLMConfig(
            provider=ProviderType.VERCEL,
            api_key=settings.VERCEL_API_KEY,
            api_url=settings.VERCEL_API_URL,
            timeout=settings.VERCEL_TIMEOUT,
            # Verificado funcionando (nov 2026): alibaba/qwen-3-32b.
            models=["alibaba/qwen-3-32b", "alibaba/qwen3.8-flash", "alibaba/qwen3-coder-30b-a3b"],
            enabled=has_key(settings.VERCEL_API_KEY),
            priority=6,
            label="Vercel AI Gateway", note="Verificado: qwen-3-32b",
        ),
        ProviderType.GEMINI: LLMConfig(
            provider=ProviderType.GEMINI,
            api_key=settings.GEMINI_API_KEY,
            api_url=settings.GEMINI_API_URL,
            timeout=settings.GEMINI_TIMEOUT,
            models=["gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"],
            enabled=has_key(settings.GEMINI_API_KEY),
            priority=6,
            label="Google Gemini", note="La key AQ. actual da 503 en generateContent",
        ),
        ProviderType.CUSTOM: LLMConfig(
            provider=ProviderType.CUSTOM,
            api_key=settings.CUSTOM_LLM_API_KEY,
            api_url=settings.CUSTOM_LLM_ENDPOINT or AnyHttpUrl("http://localhost:8000"),
            timeout=60,
            models=["custom"],
            enabled=settings.CUSTOM_LLM_ENDPOINT is not None,
            priority=6,
            label="Custom endpoint",
        ),
    },
)


# ============================================
# CAPA DE OVERRIDES EN RUNTIME (gestionada desde la UI)
# ============================================
# La key/url/modelos definidos por el usuario tienen PRIORIDAD sobre el .env.
# El .env queda como respaldo. Los proveedores "custom" se agregan aquí también.
#
# Estructura por provider_id:
#   { "api_key": str, "api_url": str|None, "models": [str]|None,
#     "label": str|None, "is_custom": bool, "timeout": int }
_runtime: Dict[str, Dict[str, Any]] = {}

# URLs base por defecto de los proveedores conocidos (para overrides de solo-key).
_DEFAULT_URLS: Dict[str, str] = {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "deepseek": "https://api.deepseek.com",
    "mistral": "https://api.mistral.ai",
    "gemini": "https://generativelanguage.googleapis.com",
    "groq": "https://api.groq.com/openai",
    "openrouter": "https://openrouter.ai/api",
    "nvidia": "https://integrate.api.nvidia.com",
    "cloudflare": "https://api.cloudflare.com",
    "vercel": "https://ai-gateway.vercel.sh",
}


def set_runtime_overrides(overrides: Dict[str, Dict[str, Any]]) -> None:
    """Reemplaza por completo la capa de overrides (llamado tras leer la DB)."""
    global _runtime
    _runtime = overrides or {}


def effective_api_key(provider_id: str) -> Optional[str]:
    """Key efectiva: override de UI si existe, si no la del .env."""
    ov = _runtime.get(provider_id)
    if ov and ov.get("api_key"):
        return ov["api_key"]
    try:
        cfg = llm_config.providers.get(ProviderType(provider_id))
        return cfg.api_key if cfg else None
    except ValueError:
        return None


def effective_api_url(provider_id: str) -> str:
    """URL base efectiva: override de UI, si no .env, si no el default conocido."""
    ov = _runtime.get(provider_id)
    if ov and ov.get("api_url"):
        return str(ov["api_url"])
    try:
        cfg = llm_config.providers.get(ProviderType(provider_id))
        if cfg:
            return str(cfg.api_url)
    except ValueError:
        pass
    return _DEFAULT_URLS.get(provider_id, "http://localhost:8000")


def effective_models(provider_id: str) -> List[str]:
    """Modelos efectivos: override de UI si tiene, si no los del catálogo."""
    ov = _runtime.get(provider_id)
    if ov and ov.get("models"):
        return list(ov["models"])
    try:
        cfg = llm_config.providers.get(ProviderType(provider_id))
        return list(cfg.models) if cfg else []
    except ValueError:
        return []


def is_custom_provider(provider_id: str) -> bool:
    ov = _runtime.get(provider_id)
    return bool(ov and ov.get("is_custom"))


def provider_timeout(provider_id: str) -> int:
    ov = _runtime.get(provider_id)
    if ov and ov.get("timeout"):
        return int(ov["timeout"])
    try:
        cfg = llm_config.providers.get(ProviderType(provider_id))
        return cfg.timeout if cfg else 60
    except ValueError:
        return 60


def provider_enabled(provider_id: str) -> bool:
    """Habilitado si hay key efectiva real (override o .env)."""
    return has_key(effective_api_key(provider_id))


def all_provider_ids() -> List[str]:
    """IDs conocidos (enum) + custom agregados por la UI."""
    ids = [p.value for p in ProviderType]
    for pid, ov in _runtime.items():
        if ov.get("is_custom") and pid not in ids:
            ids.append(pid)
    return ids


def provider_catalog() -> list:
    """Catálogo de proveedores y sus modelos permitidos para la UI.

    Combina los proveedores del enum + los custom agregados desde la UI.
    Refleja la key efectiva (override de UI o .env) para el flag enabled.
    """
    out = []
    seen = set()
    # proveedores conocidos, en el orden de failover
    for p in llm_config.failover_order:
        cfg = llm_config.providers.get(p)
        if not cfg:
            continue
        pid = p.value
        seen.add(pid)
        out.append({
            "id": pid,
            "label": (_runtime.get(pid, {}).get("label") or cfg.label or pid.capitalize()),
            "enabled": provider_enabled(pid),
            "models": effective_models(pid),
            "note": cfg.note,
            "default_model": (effective_models(pid)[0] if effective_models(pid) else None),
            "api_url": effective_api_url(pid),
            "is_custom": False,
        })
    # proveedores custom agregados desde la UI
    for pid, ov in _runtime.items():
        if pid in seen or not ov.get("is_custom"):
            continue
        models = list(ov.get("models") or [])
        out.append({
            "id": pid,
            "label": ov.get("label") or pid,
            "enabled": provider_enabled(pid),
            "models": models,
            "note": "Proveedor custom",
            "default_model": models[0] if models else None,
            "api_url": effective_api_url(pid),
            "is_custom": True,
        })
    return out


# Get enabled providers
enabled_providers = [
    p for p in llm_config.failover_order 
    if llm_config.providers.get(p, {}).enabled
]
