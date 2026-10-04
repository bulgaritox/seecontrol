"""
Agents API Router
Handles CRUD operations for agents
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import logging

from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskStatus, TaskPriority
from ..models.user import User
from ..models.workspace import Workspace
from ..schemas.agent import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse, AgentAssign
from ..services.auth import auth_service
from ..services.orchestration import orchestration_service
from ..services.llm import llm_service, LLMError
from ..services.moods import mood_for
from ..config.llm import ProviderType
from ..config.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agents"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST AGENTS
# ============================================

@router.get("/", response_model=AgentListResponse)
async def list_agents(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    status: Optional[AgentStatus] = None,
    page: int = 1,
    page_size: int = 50,
):
    """List all agents with optional filtering"""
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
    query = select(Agent)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Agent.workspace_id == workspace_id)
    else:
        # Only show agents from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = list(result.scalars().all())
        if workspace_ids:
            query = query.where(Agent.workspace_id.in_(workspace_ids))
    
    # Filter by status
    if status:
        query = query.where(Agent.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    agents = result.scalars().all()
    
    return AgentListResponse(
        agents=[
            AgentResponse(
                id=str(a.id),
                name=a.name,
                role=a.role,
                character_type=a.character_type,
                status=a.status,
                progress=a.progress,
                current_task=a.current_task,
                skills=a.skills,
                tools=a.tools,
                disallowed_tools=a.disallowed_tools,
                personality=a.personality,
                memory=a.memory,
                model=a.model,
                provider=a.provider,
                temperature=a.temperature,
                max_tokens=a.max_tokens,
                dependencies=a.dependencies,
                handoff_to=a.handoff_to,
                max_turns=a.max_turns,
                token_budget=a.token_budget,
                is_active=a.is_active,
                user_id=str(a.user_id),
                workspace_id=str(a.workspace_id),
                created_at=a.created_at,
                updated_at=a.updated_at,
                is_available=a.is_available,
                is_busy=a.is_busy,
                is_blocked=a.is_blocked,
            )
            for a in agents
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# GET AGENT BY ID
# ============================================

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific agent by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if agent.user_id != user_id:
        # Check if user is admin/owner of the workspace
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        role=agent.role,
        character_type=agent.character_type,
        status=agent.status,
        progress=agent.progress,
        current_task=agent.current_task,
        skills=agent.skills,
        tools=agent.tools,
        disallowed_tools=agent.disallowed_tools,
        personality=agent.personality,
        memory=agent.memory,
        model=agent.model,
        provider=agent.provider,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
        dependencies=agent.dependencies,
        handoff_to=agent.handoff_to,
        max_turns=agent.max_turns,
        token_budget=agent.token_budget,
        is_active=agent.is_active,
        user_id=str(agent.user_id),
        workspace_id=str(agent.workspace_id),
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        is_available=agent.is_available,
        is_busy=agent.is_busy,
        is_blocked=agent.is_blocked,
    )


# ============================================
# CREATE AGENT
# ============================================

@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent"""
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
    
    # Check if user can create agents
    if not user.can_create_agents:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create agents"
        )
    
    # Get default workspace
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        # Create default workspace
        workspace = Workspace(
            name=f"{user.workspace_name}-workspace",
            user_id=user_id,
        )
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)
    
    # Create agent
    agent = Agent(
        name=agent_data.name,
        role=agent_data.role,
        description=agent_data.description,
        character_type=agent_data.character_type or "custom",
        status=agent_data.status or AgentStatus.IDLE,
        progress=agent_data.progress or 0.0,
        current_task=agent_data.current_task,
        skills=agent_data.skills or [],
        tools=agent_data.tools or [],
        disallowed_tools=agent_data.disallowed_tools or [],
        personality=agent_data.personality,
        memory=agent_data.memory,
        model=agent_data.model,
        provider=agent_data.provider,
        temperature=agent_data.temperature or 0.7,
        max_tokens=agent_data.max_tokens or 4096,
        dependencies=agent_data.dependencies or [],
        handoff_to=agent_data.handoff_to or [],
        max_turns=agent_data.max_turns or 50,
        token_budget=agent_data.token_budget or 10000,
        is_active=agent_data.is_active,
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    
    logger.info(f"Agent created: {agent.name} (ID: {agent.id})")
    
    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        role=agent.role,
        character_type=agent.character_type,
        status=agent.status,
        progress=agent.progress,
        current_task=agent.current_task,
        skills=agent.skills,
        tools=agent.tools,
        disallowed_tools=agent.disallowed_tools,
        personality=agent.personality,
        memory=agent.memory,
        model=agent.model,
        provider=agent.provider,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
        dependencies=agent.dependencies,
        handoff_to=agent.handoff_to,
        max_turns=agent.max_turns,
        token_budget=agent.token_budget,
        is_active=agent.is_active,
        user_id=str(agent.user_id),
        workspace_id=str(agent.workspace_id),
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        is_available=agent.is_available,
        is_busy=agent.is_busy,
        is_blocked=agent.is_blocked,
    )


# ============================================
# UPDATE AGENT
# ============================================

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing agent"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if agent.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update agent
    if agent_data.name:
        agent.name = agent_data.name
    if agent_data.role:
        agent.role = agent_data.role
    if agent_data.description is not None:
        agent.description = agent_data.description
    if agent_data.character_type:
        agent.character_type = agent_data.character_type
    if agent_data.status:
        agent.status = agent_data.status
    if agent_data.progress is not None:
        agent.progress = agent_data.progress
    if agent_data.current_task is not None:
        agent.current_task = agent_data.current_task
    if agent_data.skills is not None:
        agent.skills = agent_data.skills
    if agent_data.tools is not None:
        agent.tools = agent_data.tools
    if agent_data.disallowed_tools is not None:
        agent.disallowed_tools = agent_data.disallowed_tools
    if agent_data.personality is not None:
        agent.personality = agent_data.personality
    if agent_data.memory is not None:
        agent.memory = agent_data.memory
    if agent_data.model is not None:
        agent.model = agent_data.model
    if agent_data.provider is not None:
        agent.provider = agent_data.provider
    if agent_data.temperature is not None:
        agent.temperature = agent_data.temperature
    if agent_data.max_tokens is not None:
        agent.max_tokens = agent_data.max_tokens
    if agent_data.dependencies is not None:
        agent.dependencies = agent_data.dependencies
    if agent_data.handoff_to is not None:
        agent.handoff_to = agent_data.handoff_to
    if agent_data.max_turns is not None:
        agent.max_turns = agent_data.max_turns
    if agent_data.token_budget is not None:
        agent.token_budget = agent_data.token_budget
    if agent_data.is_active is not None:
        agent.is_active = agent_data.is_active
    
    agent.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(agent)
    
    logger.info(f"Agent updated: {agent.name} (ID: {agent.id})")
    
    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        role=agent.role,
        character_type=agent.character_type,
        status=agent.status,
        progress=agent.progress,
        current_task=agent.current_task,
        skills=agent.skills,
        tools=agent.tools,
        disallowed_tools=agent.disallowed_tools,
        personality=agent.personality,
        memory=agent.memory,
        model=agent.model,
        provider=agent.provider,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
        dependencies=agent.dependencies,
        handoff_to=agent.handoff_to,
        max_turns=agent.max_turns,
        token_budget=agent.token_budget,
        is_active=agent.is_active,
        user_id=str(agent.user_id),
        workspace_id=str(agent.workspace_id),
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        is_available=agent.is_available,
        is_busy=agent.is_busy,
        is_blocked=agent.is_blocked,
    )


# ============================================
# DELETE AGENT
# ============================================

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if agent.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await db.delete(agent)
    await db.commit()
    
    logger.info(f"Agent deleted: {agent.name} (ID: {agent.id})")


# ============================================
# ASSIGN TASK TO AGENT
# ============================================

@router.post("/{agent_id}/assign", response_model=AgentResponse)
async def assign_task_to_agent(
    agent_id: str,
    assignment: AgentAssign,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Assign a task to an agent"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if agent.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Get task
    result = await db.execute(
        select(Task).where(Task.id == assignment.task_id)
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Assign task to agent
    task.agent_id = agent_id
    task.status = TaskStatus.IN_PROGRESS
    task.priority = TaskPriority(assignment.priority) if assignment.priority else task.priority
    
    agent.status = AgentStatus.WORKING
    agent.current_task = task.title
    agent.current_task_id = assignment.task_id
    
    await db.commit()
    
    logger.info(f"Task {assignment.task_id} assigned to agent {agent_id}")
    
    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        role=agent.role,
        character_type=agent.character_type,
        status=agent.status,
        progress=agent.progress,
        current_task=agent.current_task,
        skills=agent.skills,
        tools=agent.tools,
        disallowed_tools=agent.disallowed_tools,
        personality=agent.personality,
        memory=agent.memory,
        model=agent.model,
        provider=agent.provider,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
        dependencies=agent.dependencies,
        handoff_to=agent.handoff_to,
        max_turns=agent.max_turns,
        token_budget=agent.token_budget,
        is_active=agent.is_active,
        user_id=str(agent.user_id),
        workspace_id=str(agent.workspace_id),
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        is_available=agent.is_available,
        is_busy=agent.is_busy,
        is_blocked=agent.is_blocked,
    )


# ============================================
# GET AGENT OFFICE STATE
# ============================================

@router.get("/{agent_id}/office-state", response_model=dict)
async def get_agent_office_state(
    agent_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get agent state for office visualization"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if agent.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return agent.to_office_state()


class AgentPing(BaseModel):
    """Tiny test message for an agent (minimal tokens)"""
    message: Optional[str] = "Responde solo: OK"


# ============================================
# PING AGENT (prueba viva con su proveedor)
# ============================================

@router.post("/{agent_id}/ping", response_model=dict)
async def ping_agent(
    agent_id: str,
    payload: AgentPing,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Envía un mensaje mínimo al proveedor del agente.

    Si el proveedor responde, devuelve su réplica. Si falla (rate limit,
    sin cuota, key inválida...), devuelve un mensaje con personalidad
    (headline divertido + error real en pequeño).
    """
    auth = auth_service.verify_token(token)
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = auth.get("sub")
    
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if agent.user_id != user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    provider_name = (agent.provider or "mistral").lower()
    try:
        provider = ProviderType(provider_name)
    except ValueError:
        provider = ProviderType.MISTRAL
    
    model = agent.model or "mistral-small-latest"
    question = (payload.message or "Responde solo: OK").strip()[:200]
    
    try:
        content, tokens, used = await llm_service.chat(
            provider=provider,
            model=model,
            messages=[
                {"role": "system", "content": f"Eres {agent.name}, {agent.role} del equipo SeeControl. Responde en una sola línea."},
                {"role": "user", "content": question},
            ],
            max_tokens=15,
            temperature=0,
        )
        return {
            "ok": True,
            "reply": content,
            "tokens": tokens,
            "provider": used,
            "model": model,
            "agent": agent.name,
        }
    except LLMError as e:
        return {
            "ok": False,
            "agent": agent.name,
            "provider": provider.value,
            "model": model,
            "mood": mood_for(e.message, provider.value, agent.name),
        }
