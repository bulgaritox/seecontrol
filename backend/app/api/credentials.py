"""
Credentials API — gestión de API keys por proveedor desde la UI.

- Múltiples keys por proveedor, con etiqueta/nombre y una activa.
- Proveedores custom (nombre + api_url + modelos), se validan antes de guardar.
- Test de una key (sin guardar) usado por el Playground.
- Uso/créditos del proveedor cuando su API lo expone.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from ..config.database import get_db
from ..models.provider_credential import ProviderCredential
from ..services.auth import auth_service
from ..services.credentials import refresh_overrides
from ..services.llm import llm_service, LLMError
from ..config import llm as llmcfg
from ..config.llm import effective_api_url

logger = logging.getLogger(__name__)
router = APIRouter(tags=["credentials"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


def _auth(token: str) -> str:
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return payload.get("sub")


def _mask(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return key[:2] + "***"
    return key[:4] + "…" + key[-4:]


def _to_dict(c: ProviderCredential) -> dict:
    return {
        "id": c.id,
        "provider_id": c.provider_id,
        "label": c.label,
        "api_key_masked": _mask(c.api_key),
        "is_active": c.is_active,
        "is_custom": c.is_custom,
        "label_display": c.label_display,
        "api_url": c.api_url,
        "models": c.models or [],
    }


# ============================================
# LISTAR CREDENCIALES
# ============================================

@router.get("/")
async def list_credentials(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    _auth(token)
    res = await db.execute(select(ProviderCredential))
    creds = res.scalars().all()
    return {"credentials": [_to_dict(c) for c in creds]}


class CredentialCreate(BaseModel):
    provider_id: str
    label: str
    api_key: str
    # custom:
    is_custom: bool = False
    label_display: Optional[str] = None
    api_url: Optional[str] = None
    models: Optional[List[str]] = None
    make_active: bool = True


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_credential(body: CredentialCreate, token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    uid = _auth(token)
    cred = ProviderCredential(
        provider_id=body.provider_id.strip().lower(),
        label=body.label.strip() or "key",
        api_key=body.api_key.strip(),
        is_custom=body.is_custom,
        label_display=body.label_display,
        api_url=body.api_url,
        models=body.models or [],
        user_id=uid,
    )
    if body.make_active:
        # desactivar las demás del proveedor
        res = await db.execute(select(ProviderCredential).where(ProviderCredential.provider_id == cred.provider_id))
        for other in res.scalars().all():
            other.is_active = False
        cred.is_active = True
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    await refresh_overrides()
    return _to_dict(cred)


class CredentialUpdate(BaseModel):
    label: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    models: Optional[List[str]] = None
    label_display: Optional[str] = None


@router.put("/{cred_id}")
async def update_credential(cred_id: str, body: CredentialUpdate, token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    _auth(token)
    res = await db.execute(select(ProviderCredential).where(ProviderCredential.id == cred_id))
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404)
    if body.label is not None:
        cred.label = body.label.strip()
    if body.api_key is not None and body.api_key.strip():
        cred.api_key = body.api_key.strip()
    if body.api_url is not None:
        cred.api_url = body.api_url
    if body.models is not None:
        cred.models = body.models
    if body.label_display is not None:
        cred.label_display = body.label_display
    await db.commit()
    await refresh_overrides()
    return _to_dict(cred)


@router.post("/{cred_id}/activate")
async def activate_credential(cred_id: str, token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    _auth(token)
    res = await db.execute(select(ProviderCredential).where(ProviderCredential.id == cred_id))
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404)
    res2 = await db.execute(select(ProviderCredential).where(ProviderCredential.provider_id == cred.provider_id))
    for other in res2.scalars().all():
        other.is_active = (other.id == cred_id)
    await db.commit()
    await refresh_overrides()
    return {"status": "active", "id": cred_id, "provider_id": cred.provider_id}


@router.delete("/{cred_id}")
async def delete_credential(cred_id: str, token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    _auth(token)
    res = await db.execute(select(ProviderCredential).where(ProviderCredential.id == cred_id))
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404)
    pid = cred.provider_id
    was_active = cred.is_active
    await db.delete(cred)
    await db.commit()
    # si borramos la activa, activar otra que quede
    if was_active:
        res2 = await db.execute(select(ProviderCredential).where(ProviderCredential.provider_id == pid))
        rest = res2.scalars().all()
        if rest:
            rest[0].is_active = True
            await db.commit()
    await refresh_overrides()
    return {"status": "deleted", "id": cred_id}


# ============================================
# TEST (sin guardar) — usado por Playground y alta de custom
# ============================================

class TestBody(BaseModel):
    provider_id: str
    api_key: Optional[str] = None     # si no se pasa, usa la efectiva
    api_url: Optional[str] = None     # para custom
    model: str
    message: str = "Responde solo: OK"
    is_custom: bool = False


@router.post("/test")
async def test_credential(body: TestBody, token: str = Depends(oauth2_scheme)):
    """Prueba una key/modelo contra el proveedor SIN guardar nada.
    Devuelve ok + respuesta, o el error del proveedor."""
    _auth(token)
    pid = body.provider_id.strip().lower()
    # aplicar un override TEMPORAL solo para esta llamada
    import copy
    prev = copy.deepcopy(llmcfg._runtime)
    try:
        ov = dict(prev.get(pid, {}))
        if body.api_key:
            ov["api_key"] = body.api_key.strip()
        if body.api_url:
            ov["api_url"] = body.api_url.strip()
        if body.is_custom:
            ov["is_custom"] = True
        merged = dict(prev)
        merged[pid] = ov
        llmcfg.set_runtime_overrides(merged)
        content, tokens, used = await llm_service.chat_effective(
            provider_id=pid, model=body.model,
            messages=[{"role": "user", "content": body.message}],
            max_tokens=512, temperature=0.3,
        )
        return {"ok": True, "reply": content[:600], "tokens": tokens, "provider": used, "model": body.model}
    except LLMError as e:
        return {"ok": False, "error": e.message, "provider": pid, "model": body.model}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], "provider": pid, "model": body.model}
    finally:
        llmcfg.set_runtime_overrides(prev)


# ============================================
# USO / CRÉDITOS del proveedor (cuando su API lo expone)
# ============================================

@router.get("/usage/{provider_id}")
async def provider_usage(provider_id: str, token: str = Depends(oauth2_scheme)):
    """Consulta el uso/créditos de la key activa de un proveedor.
    Solo algunos proveedores exponen esto (OpenRouter sí). Para el resto
    devuelve available=false con una nota."""
    _auth(token)
    pid = provider_id.strip().lower()
    key = llmcfg.effective_api_key(pid)
    if not key:
        return {"available": False, "note": "Sin API key activa"}

    try:
        if pid == "openrouter":
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.get("https://openrouter.ai/api/v1/key",
                                headers={"Authorization": f"Bearer {key}"})
                if r.status_code == 200:
                    d = r.json().get("data", {})
                    limit = d.get("limit")
                    usage = d.get("usage")
                    return {
                        "available": True, "provider": pid,
                        "usage": usage, "limit": limit,
                        "is_free_tier": d.get("is_free_tier"),
                        "label": f"{usage} usado" + (f" / {limit}" if limit is not None else " (sin tope definido)"),
                    }
                return {"available": False, "note": f"OpenRouter respondió {r.status_code}"}

        if pid == "groq":
            # Groq no expone créditos por API pública; informamos.
            return {"available": False, "note": "Groq no expone consumo por API (tier gratuito con rate limits)"}

        if pid == "mistral":
            return {"available": False, "note": "Mistral no expone saldo por API pública"}

        return {"available": False, "note": "Este proveedor no expone uso/créditos por API"}
    except Exception as e:
        return {"available": False, "note": f"Error consultando uso: {str(e)[:120]}"}
