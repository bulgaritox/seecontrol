"""
Seed de datos inicial.

Crea (de forma idempotente) el usuario admin que el frontend usa para loguear
(`admin@seecontrol.io` / `admin123`), su workspace, y los agentes del ROSTER que
el frontend espera por nombre. Cada agente recibe un proveedor/modelo REAL
verificado para que su chat/ejecución funcione con BYOK.

Se ejecuta en el arranque (lifespan) y no duplica nada si ya existe.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config.database import get_db_context
from ..models.user import User, UserRole
from ..models.workspace import Workspace
from ..models.agent import Agent, AgentStatus
from ..services.auth import auth_service

logger = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@seecontrol.io"
ADMIN_PASSWORD = "admin123"

# ROSTER: debe coincidir por NOMBRE con frontend/src/data/demo.ts.
# provider/model usan valores verificados que responden con las API keys del .env.
# (groq, mistral y vercel confirmados; openrouter/nvidia/cloudflare quedan listos
#  para activarse cuando tengan modelo válido/cuota).
ROSTER_SEED = [
    # Boss (orquestador) usa Mistral: respuestas limpias y rápidas.
    {"name": "Boss",   "role": "Orquestador · Master AI", "character_type": "boss",
     "provider": "mistral",  "model": "ministral-3b-latest"},
    {"name": "Luna",   "role": "Copywriter",              "character_type": "luna",
     "provider": "mistral",  "model": "ministral-3b-latest"},
    {"name": "Max",    "role": "Developer",               "character_type": "max",
     "provider": "vercel",   "model": "alibaba/qwen-3-32b"},
    {"name": "Pixel",  "role": "Designer",                "character_type": "pixel",
     "provider": "vercel",   "model": "alibaba/qwen-3-32b"},
    {"name": "Data",   "role": "Data Analyst",            "character_type": "data",
     "provider": "mistral",  "model": "ministral-3b-latest"},
    {"name": "Scout",  "role": "Researcher",              "character_type": "scout",
     "provider": "vercel",   "model": "alibaba/qwen-3-32b"},
    {"name": "Layout", "role": "Layout Assistant",        "character_type": "layout",
     "provider": "groq",     "model": "openai/gpt-oss-20b"},
    {"name": "Nex",    "role": "Generalist · QA",         "character_type": "nex",
     "provider": "mistral",  "model": "ministral-3b-latest"},
]


async def _ensure_admin(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(
        email=ADMIN_EMAIL,
        hashed_password=auth_service.hash_password(ADMIN_PASSWORD),
        workspace_name="SeeControl",
        role=UserRole.OWNER,
        theme="pixel",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"Seed: usuario admin creado ({ADMIN_EMAIL})")
    return user


async def _ensure_workspace(db: AsyncSession, user: User) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.user_id == user.id).limit(1))
    ws = result.scalar_one_or_none()
    if ws:
        return ws
    ws = Workspace(name=f"{user.workspace_name}-workspace", user_id=user.id)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    logger.info("Seed: workspace creado")
    return ws


async def _ensure_agents(db: AsyncSession, user: User, ws: Workspace) -> int:
    # nombres ya existentes en el workspace
    result = await db.execute(select(Agent.name).where(Agent.workspace_id == str(ws.id)))
    existing = {n.lower() for n in result.scalars().all()}
    created = 0
    for spec in ROSTER_SEED:
        if spec["name"].lower() in existing:
            continue
        agent = Agent(
            name=spec["name"],
            role=spec["role"],
            character_type=spec["character_type"],
            status=AgentStatus.IDLE,
            provider=spec["provider"],
            model=spec["model"],
            temperature=0.6,
            max_tokens=1024,
            is_active=True,
            user_id=user.id,
            workspace_id=str(ws.id),
        )
        db.add(agent)
        created += 1
    if created:
        await db.commit()
        logger.info(f"Seed: {created} agentes del ROSTER creados")
    return created


async def seed_initial_data() -> None:
    """Punto de entrada: siembra admin, workspace y agentes del ROSTER."""
    try:
        async with get_db_context() as db:
            user = await _ensure_admin(db)
            ws = await _ensure_workspace(db, user)
            await _ensure_agents(db, user, ws)
        logger.info("Seed inicial completado")
    except Exception as e:  # el arranque no debe caerse por el seed
        logger.error(f"Seed inicial falló (no crítico): {e}")
