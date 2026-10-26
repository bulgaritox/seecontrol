"""
Skills API Router
Handles CRUD operations for skills
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
import logging
import re
import httpx

from ..models.skill import Skill, SkillCategory
from ..models.user import User
from ..models.workspace import Workspace
from ..schemas.skill import (
    SkillCreate, 
    SkillUpdate, 
    SkillResponse, 
    SkillListResponse,
    SkillCard,
    SkillTrigger
)
from ..services.auth import auth_service
from ..config.database import get_db
from ..config.websocket import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["skills"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST SKILLS
# ============================================

@router.get("/", response_model=SkillListResponse)
async def list_skills(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    category: Optional[SkillCategory] = None,
    marketplace: Optional[bool] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
):
    """List all skills with optional filtering"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Build query
    query = select(Skill)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Skill.workspace_id == workspace_id)
    else:
        # Only show skills from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = list(result.scalars().all())
        if workspace_ids:
            query = query.where(Skill.workspace_id.in_(workspace_ids))
    
    # Filter by category
    if category:
        query = query.where(Skill.category == category)
    
    # Filter by marketplace
    if marketplace is not None:
        query = query.where(Skill.marketplace == marketplace)
    
    # Filter by active
    if is_active is not None:
        query = query.where(Skill.is_active == is_active)
    
    # Order by created_at descending
    query = query.order_by(desc(Skill.created_at))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    skills = result.scalars().all()
    
    return SkillListResponse(
        skills=[
            SkillResponse(
                id=str(s.id),
                name=s.name,
                description=s.description,
                category=s.category,
                instructions=s.instructions,
                examples=s.examples,
                version=s.version,
                author=s.author,
                author_id=str(s.author_id),
                marketplace=s.marketplace,
                price=s.price,
                rating=s.rating,
                downloads=s.downloads,
                triggers=s.triggers,
                dependencies=s.dependencies,
                is_active=s.is_active,
                is_certified=s.is_certified,
                user_id=str(s.user_id),
                workspace_id=str(s.workspace_id),
                created_at=s.created_at,
                updated_at=s.updated_at,
                tags=s.tags,
                display_name=s.display_name,
            )
            for s in skills
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# IMPORT SKILL FROM URL (GitHub SKILL.md) — server-side, sin CORS
# IMPORTANTE: debe ir ANTES de las rutas /{skill_id} para que POST /import
# no quede capturado por el patrón /{skill_id} (que devolvería 405).
# ============================================

class SkillImportRequest(BaseModel):
    """URL a un SKILL.md o a la carpeta de la skill en GitHub."""
    url: str


def _normalize_skill_url(url: str) -> List[str]:
    """Convierte una URL de GitHub (blob/tree/raw o carpeta) en una lista de
    URLs raw candidatas a SKILL.md. Devuelve varias para intentar en orden."""
    u = url.strip()
    candidates: List[str] = []

    # github.com/<owner>/<repo>/blob/<branch>/<path>  -> raw
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)", u)
    if m:
        owner, repo, branch, path = m.groups()
        raw = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
        candidates.append(raw)
        if not path.lower().endswith(".md"):
            candidates.append(raw.rstrip("/") + "/SKILL.md")
        return candidates

    # github.com/<owner>/<repo>/tree/<branch>/<path>  (carpeta) -> raw .../SKILL.md
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.+)", u)
    if m:
        owner, repo, branch, path = m.groups()
        base = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path.rstrip('/')}"
        candidates.append(base + "/SKILL.md")
        candidates.append(base + "/skill.md")
        return candidates

    # Ya es raw.githubusercontent.com
    if "raw.githubusercontent.com" in u:
        candidates.append(u)
        if not u.lower().endswith(".md"):
            candidates.append(u.rstrip("/") + "/SKILL.md")
        return candidates

    # Cualquier otra URL: úsala tal cual, y si no es .md prueba /SKILL.md
    candidates.append(u)
    if not u.lower().endswith(".md"):
        candidates.append(u.rstrip("/") + "/SKILL.md")
    return candidates


def _parse_skill_md(raw: str, source_url: str) -> dict:
    """Parsea un SKILL.md (frontmatter YAML simple + cuerpo markdown)."""
    front, body = "", raw
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.DOTALL)
    if m:
        front, body = m.group(1), m.group(2)
    meta: dict = {}
    for line in front.split("\n"):
        i = line.find(":")
        if i > 0:
            k = line[:i].strip().lower()
            v = line[i + 1:].strip().strip("'\"")
            meta[k] = v
    seg = [p for p in source_url.split("/") if p and p.lower() not in ("skill.md",)]
    folder = seg[-1] if seg else "skill"
    raw_name = meta.get("name") or folder or "skill-importada"
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", raw_name)
    blob = f"{meta.get('description', '')}\n{body}".lower()
    # Diseño primero: muchas skills de diseño mencionan "code"/"review" de pasada.
    design_hits = len(re.findall(r"design|dise[ñn]|aesthetic|ui/ux|\bui\b|\bux\b|visual|color|palette|typograph|tipograf|layout|theme|neon|spacing|tokens?|frontend|front-end", blob))
    code_hits = len(re.findall(r"\btest\b|tdd|commit|\bpr\b|refactor|endpoint|backend", blob))
    if design_hits >= 2 and design_hits >= code_hits:
        cat = "image"
    elif code_hits >= 2:
        cat = "code"
    elif re.search(r"seo|blog|writ|redact|copy", blob):
        cat = "writing"
    elif re.search(r"sql|data|migrat", blob):
        cat = "data"
    elif re.search(r"search|research|investig|benchmark", blob):
        cat = "research"
    elif re.search(r"video", blob):
        cat = "video"
    else:
        cat = "general"
    description = meta.get("description") or next(
        (l.strip() for l in body.split("\n") if len(l.strip()) > 20), "Skill importada."
    )[:300]
    return {
        "name": name if name.lower().startswith("skill") else f"Skill_{name}",
        "description": description,
        "category": cat,
        "instructions": body.strip()[:8000] or "Ver fuente original.",
        "author": meta.get("author") or "GitHub-Import",
        "tags": ["importada", "github"],
        "source_url": source_url,
    }


@router.post("/import", response_model=dict)
async def import_skill(
    payload: SkillImportRequest,
    token: str = Depends(oauth2_scheme),
):
    """Descarga un SKILL.md desde GitHub (server-side, evita CORS) y lo parsea.
    Acepta enlaces blob/tree/raw o a la carpeta de la skill."""
    if not auth_service.verify_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    candidates = _normalize_skill_url(payload.url)
    last_err = ""
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for cand in candidates:
            try:
                r = await client.get(cand, headers={"User-Agent": "SeeControl-SkillImporter"})
                if r.status_code == 200 and r.text.strip():
                    parsed = _parse_skill_md(r.text, cand)
                    parsed["resolved_url"] = cand
                    return {"ok": True, "skill": parsed}
                last_err = f"HTTP {r.status_code} en {cand}"
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
                continue
    return {"ok": False, "error": last_err or "No se pudo descargar el SKILL.md", "tried": candidates}


# ============================================
# GET SKILL
# ============================================

@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific skill by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get skill
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == skill.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return SkillResponse(
        id=str(skill.id),
        name=skill.name,
        description=skill.description,
        category=skill.category,
        instructions=skill.instructions,
        examples=skill.examples,
        version=skill.version,
        author=skill.author,
        author_id=str(skill.author_id),
        marketplace=skill.marketplace,
        price=skill.price,
        rating=skill.rating,
        downloads=skill.downloads,
        triggers=skill.triggers,
        dependencies=skill.dependencies,
        is_active=skill.is_active,
        is_certified=skill.is_certified,
        user_id=str(skill.user_id),
        workspace_id=str(skill.workspace_id),
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=skill.tags,
        display_name=skill.display_name,
    )


# ============================================
# CREATE SKILL
# ============================================

@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    skill_data: SkillCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new skill"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get user's default workspace
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Please create a workspace first."
        )
    
    # Create skill
    skill = Skill(
        name=skill_data.name,
        description=skill_data.description,
        category=skill_data.category,
        instructions=skill_data.instructions,
        examples=skill_data.examples,
        version=skill_data.version,
        author=skill_data.author,
        author_id=skill_data.author_id,
        marketplace=skill_data.marketplace,
        price=skill_data.price,
        triggers=skill_data.triggers,
        dependencies=skill_data.dependencies,
        is_active=skill_data.is_active,
        is_certified=skill_data.is_certified,
        tags=skill_data.tags,
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    
    logger.info(f"Skill created: {skill.name} (id={skill.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_skill_update(skill)
    
    return SkillResponse(
        id=str(skill.id),
        name=skill.name,
        description=skill.description,
        category=skill.category,
        instructions=skill.instructions,
        examples=skill.examples,
        version=skill.version,
        author=skill.author,
        author_id=str(skill.author_id),
        marketplace=skill.marketplace,
        price=skill.price,
        rating=skill.rating,
        downloads=skill.downloads,
        triggers=skill.triggers,
        dependencies=skill.dependencies,
        is_active=skill.is_active,
        is_certified=skill.is_certified,
        user_id=str(skill.user_id),
        workspace_id=str(skill.workspace_id),
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=skill.tags,
        display_name=skill.display_name,
    )


# ============================================
# UPDATE SKILL
# ============================================

@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    skill_data: SkillUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update a skill"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get skill
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == skill.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update skill
    update_data = skill_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(skill, key, value)
    
    skill.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(skill)
    
    logger.info(f"Skill updated: {skill.name} (id={skill.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_skill_update(skill)
    
    return SkillResponse(
        id=str(skill.id),
        name=skill.name,
        description=skill.description,
        category=skill.category,
        instructions=skill.instructions,
        examples=skill.examples,
        version=skill.version,
        author=skill.author,
        author_id=str(skill.author_id),
        marketplace=skill.marketplace,
        price=skill.price,
        rating=skill.rating,
        downloads=skill.downloads,
        triggers=skill.triggers,
        dependencies=skill.dependencies,
        is_active=skill.is_active,
        is_certified=skill.is_certified,
        user_id=str(skill.user_id),
        workspace_id=str(skill.workspace_id),
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=skill.tags,
        display_name=skill.display_name,
    )


# ============================================
# DELETE SKILL
# ============================================

@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a skill"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get skill
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == skill.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await db.delete(skill)
    await db.commit()
    
    logger.info(f"Skill deleted: {skill.name} (id={skill.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_skill_update(skill)


# ============================================
# MARKETPLACE CARDS
# ============================================

@router.get("/marketplace/cards", response_model=List[SkillCard])
async def get_marketplace_cards(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    category: Optional[SkillCategory] = None,
    is_certified: Optional[bool] = None,
):
    """Get marketplace cards (simplified skill data for display)"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Build query for marketplace skills
    query = select(Skill).where(Skill.marketplace == True)
    
    # Filter by category
    if category:
        query = query.where(Skill.category == category)
    
    # Filter by certified
    if is_certified is not None:
        query = query.where(Skill.is_certified == is_certified)
    
    # Order by rating and downloads
    query = query.order_by(desc(Skill.rating), desc(Skill.downloads))
    
    result = await db.execute(query)
    skills = result.scalars().all()
    
    return [
        SkillCard(
            id=str(s.id),
            name=s.name,
            description=s.description,
            category=s.category.value,
            version=s.version,
            author=s.author,
            price=s.price,
            rating=s.rating,
            downloads=s.downloads,
            is_certified=s.is_certified,
        )
        for s in skills
    ]


# ============================================
# DOWNLOAD SKILL
# ============================================

@router.post("/{skill_id}/download", response_model=SkillResponse)
async def download_skill(
    skill_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Download a skill from marketplace"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get skill
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if not skill.marketplace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill is not in marketplace"
        )
    
    # Get user's default workspace
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Please create a workspace first."
        )
    
    # Create a copy of the skill in user's workspace
    new_skill = Skill(
        name=skill.name,
        description=skill.description,
        category=skill.category,
        instructions=skill.instructions,
        examples=skill.examples,
        version=skill.version,
        author=skill.author,
        author_id=skill.author_id,
        marketplace=False,
        price=None,
        triggers=skill.triggers,
        dependencies=skill.dependencies,
        is_active=True,
        is_certified=False,
        tags=skill.tags,
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(new_skill)
    
    # Increment download count
    skill.downloads += 1
    
    await db.commit()
    await db.refresh(new_skill)
    await db.refresh(skill)
    
    logger.info(f"Skill downloaded: {skill.name} (id={skill.id}) by user {user_id}")
    
    return SkillResponse(
        id=str(new_skill.id),
        name=new_skill.name,
        description=new_skill.description,
        category=new_skill.category,
        instructions=new_skill.instructions,
        examples=new_skill.examples,
        version=new_skill.version,
        author=new_skill.author,
        author_id=str(new_skill.author_id),
        marketplace=new_skill.marketplace,
        price=new_skill.price,
        rating=new_skill.rating,
        downloads=new_skill.downloads,
        triggers=new_skill.triggers,
        dependencies=new_skill.dependencies,
        is_active=new_skill.is_active,
        is_certified=new_skill.is_certified,
        user_id=str(new_skill.user_id),
        workspace_id=str(new_skill.workspace_id),
        created_at=new_skill.created_at,
        updated_at=new_skill.updated_at,
        tags=new_skill.tags,
        display_name=new_skill.display_name,
    )


# (El endpoint de importación vive ARRIBA, antes de las rutas /{skill_id},
#  para que POST /import no choque con /{skill_id} y devuelva 405.)
