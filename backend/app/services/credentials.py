"""
Servicio de credenciales de proveedores.

- Siembra las keys del .env como primera capa de credenciales en la DB
  (una por proveedor con key real), para que el usuario las gestione desde la UI.
- Carga las credenciales ACTIVAS de la DB a la capa de overrides en runtime
  (config.llm), de modo que tengan prioridad sobre el .env.
"""

import logging
from typing import Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config.database import get_db_context
from ..config import llm as llmcfg
from ..config.llm import ProviderType, has_key
from ..config.settings import settings
from ..models.provider_credential import ProviderCredential

logger = logging.getLogger(__name__)

# Nombre legible por proveedor para la credencial sembrada desde .env.
_ENV_LABEL = "del .env"


def _env_key_for(provider_id: str):
    """Obtiene la key del .env para un proveedor conocido."""
    attr = {
        "anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY", "mistral": "MISTRAL_API_KEY",
        "gemini": "GEMINI_API_KEY", "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY", "nvidia": "NVIDIA_API_KEY",
        "cloudflare": "CLOUDFLARE_API_KEY", "vercel": "VERCEL_API_KEY",
        "custom": "CUSTOM_LLM_API_KEY",
    }.get(provider_id)
    return getattr(settings, attr, None) if attr else None


async def seed_credentials_from_env(db: AsyncSession) -> int:
    """Crea en la DB una credencial por cada proveedor con key REAL en el .env,
    si ese proveedor aún no tiene ninguna credencial. Idempotente."""
    created = 0
    for p in ProviderType:
        pid = p.value
        key = _env_key_for(pid)
        if not has_key(key):
            continue
        # ¿ya hay alguna credencial para este proveedor?
        res = await db.execute(
            select(func.count()).select_from(ProviderCredential).where(ProviderCredential.provider_id == pid)
        )
        if (res.scalar_one() or 0) > 0:
            continue
        cred = ProviderCredential(
            provider_id=pid, label=_ENV_LABEL, api_key=key, is_active=True, is_custom=False,
        )
        db.add(cred)
        created += 1
    if created:
        await db.commit()
        logger.info(f"Credenciales: sembradas {created} keys desde .env")
    return created


async def load_overrides_from_db(db: AsyncSession) -> None:
    """Lee las credenciales ACTIVAS (y custom) de la DB y las aplica como overrides."""
    res = await db.execute(select(ProviderCredential))
    creds = res.scalars().all()

    overrides: Dict[str, Dict[str, Any]] = {}
    # agrupar por proveedor; elegir la activa (si no, la primera)
    by_provider: Dict[str, list] = {}
    for c in creds:
        by_provider.setdefault(c.provider_id, []).append(c)

    for pid, lst in by_provider.items():
        active = next((c for c in lst if c.is_active), None) or lst[0]
        ov: Dict[str, Any] = {"api_key": active.api_key}
        if active.is_custom:
            ov["is_custom"] = True
            ov["label"] = active.label_display or pid
            if active.api_url:
                ov["api_url"] = active.api_url
            if active.models:
                ov["models"] = list(active.models)
        else:
            # proveedor conocido: permitir override de modelos si se guardaron
            if active.models:
                ov["models"] = list(active.models)
            if active.api_url:
                ov["api_url"] = active.api_url
        overrides[pid] = ov

    llmcfg.set_runtime_overrides(overrides)
    logger.info(f"Credenciales: overrides activos para {list(overrides.keys())}")


async def refresh_overrides() -> None:
    """Recarga los overrides desde la DB (llamar tras cambios en credenciales)."""
    async with get_db_context() as db:
        await load_overrides_from_db(db)


async def init_credentials() -> None:
    """Arranque: siembra desde .env y carga overrides."""
    try:
        async with get_db_context() as db:
            await seed_credentials_from_env(db)
            await load_overrides_from_db(db)
    except Exception as e:
        logger.error(f"init_credentials falló (no crítico): {e}")
