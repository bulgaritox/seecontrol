"""
Workspace API Router
Handles CRUD operations for workspaces
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
import logging

from ..models.workspace import Workspace, WorkspacePlan, MemoryScope, EscalationPolicy
from ..models.user import User
from ..models.agent import Agent
from ..models.task import Task
from ..models.skill import Skill
from ..models.mission import Mission
from ..schemas.workspace import (
    WorkspaceCreate, 
    WorkspaceUpdate, 
    WorkspaceResponse, 
    WorkspaceListResponse,
    WorkspaceSettings,
    WorkspaceStats
)
from ..services.auth import auth_service
from ..config.database import get_db
from ..config.websocket import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["workspaces"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST WORKSPACES
# ============================================

@router.get("/", response_model=WorkspaceListResponse)
async def list_workspaces(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
):
    """List all workspaces for the current user"""
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
    query = select(Workspace).where(Workspace.user_id == user_id)
    query = query.order_by(desc(Workspace.created_at))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    workspaces = result.scalars().all()
    
    return WorkspaceListResponse(
        workspaces=[
            WorkspaceResponse(
                id=str(w.id),
                name=w.name,
                description=w.description,
                plan=w.plan,
                credits=w.credits,
                max_agents=w.max_agents,
                max_parallel_agents=w.max_parallel_agents,
                max_tasks=w.max_tasks,
                max_concurrent_tasks=w.max_concurrent_tasks,
                max_automations=w.max_automations,
                max_scheduled_automations=w.max_scheduled_automations,
                max_workflows=w.max_workflows,
                max_saved_workflows=w.max_saved_workflows,
                max_task_runtime_minutes=w.max_task_runtime_minutes,
                web_research_limit=w.web_research_limit,
                file_analysis_limit_mb=w.file_analysis_limit_mb,
                token_budget=w.token_budget,
                theme=w.theme,
                layout=w.layout,
                master_ai_model=w.master_ai_model,
                default_provider=w.default_provider,
                strategy=w.strategy,
                escalation_policy=w.escalation_policy,
                heartbeat_interval=w.heartbeat_interval,
                memory_scope=w.memory_scope,
                notifications=w.notifications,
                user_id=str(w.user_id),
                created_at=w.created_at,
                updated_at=w.updated_at,
                is_free_plan=w.is_free_plan,
                can_create_agents=w.can_create_agents,
                can_run_parallel=w.can_run_parallel,
            )
            for w in workspaces
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# GET WORKSPACE
# ============================================

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific workspace by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    if workspace.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        description=workspace.description,
        plan=workspace.plan,
        credits=workspace.credits,
        max_agents=workspace.max_agents,
        max_parallel_agents=workspace.max_parallel_agents,
        max_tasks=workspace.max_tasks,
        max_concurrent_tasks=workspace.max_concurrent_tasks,
        max_automations=workspace.max_automations,
        max_scheduled_automations=workspace.max_scheduled_automations,
        max_workflows=workspace.max_workflows,
        max_saved_workflows=workspace.max_saved_workflows,
        max_task_runtime_minutes=workspace.max_task_runtime_minutes,
        web_research_limit=workspace.web_research_limit,
        file_analysis_limit_mb=workspace.file_analysis_limit_mb,
        token_budget=workspace.token_budget,
        theme=workspace.theme,
        layout=workspace.layout,
        master_ai_model=workspace.master_ai_model,
        default_provider=workspace.default_provider,
        strategy=workspace.strategy,
        escalation_policy=workspace.escalation_policy,
        heartbeat_interval=workspace.heartbeat_interval,
        memory_scope=workspace.memory_scope,
        notifications=workspace.notifications,
        user_id=str(workspace.user_id),
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        is_free_plan=workspace.is_free_plan,
        can_create_agents=workspace.can_create_agents,
        can_run_parallel=workspace.can_run_parallel,
    )


# ============================================
# CREATE WORKSPACE
# ============================================

@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    workspace_data: WorkspaceCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace"""
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
    
    # Create workspace
    workspace = Workspace(
        name=workspace_data.name,
        description=workspace_data.description,
        plan=workspace_data.plan,
        theme=workspace_data.theme,
        layout=workspace_data.layout,
        master_ai_model=workspace_data.master_ai_model,
        default_provider=workspace_data.default_provider,
        strategy=workspace_data.strategy,
        escalation_policy=workspace_data.escalation_policy,
        heartbeat_interval=workspace_data.heartbeat_interval,
        memory_scope=workspace_data.memory_scope,
        notifications=workspace_data.notifications,
        user_id=user_id,
    )
    
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    
    logger.info(f"Workspace created: {workspace.name} (id={workspace.id})")
    
    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        description=workspace.description,
        plan=workspace.plan,
        credits=workspace.credits,
        max_agents=workspace.max_agents,
        max_parallel_agents=workspace.max_parallel_agents,
        max_tasks=workspace.max_tasks,
        max_concurrent_tasks=workspace.max_concurrent_tasks,
        max_automations=workspace.max_automations,
        max_scheduled_automations=workspace.max_scheduled_automations,
        max_workflows=workspace.max_workflows,
        max_saved_workflows=workspace.max_saved_workflows,
        max_task_runtime_minutes=workspace.max_task_runtime_minutes,
        web_research_limit=workspace.web_research_limit,
        file_analysis_limit_mb=workspace.file_analysis_limit_mb,
        token_budget=workspace.token_budget,
        theme=workspace.theme,
        layout=workspace.layout,
        master_ai_model=workspace.master_ai_model,
        default_provider=workspace.default_provider,
        strategy=workspace.strategy,
        escalation_policy=workspace.escalation_policy,
        heartbeat_interval=workspace.heartbeat_interval,
        memory_scope=workspace.memory_scope,
        notifications=workspace.notifications,
        user_id=str(workspace.user_id),
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        is_free_plan=workspace.is_free_plan,
        can_create_agents=workspace.can_create_agents,
        can_run_parallel=workspace.can_run_parallel,
    )


# ============================================
# UPDATE WORKSPACE
# ============================================

@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    workspace_data: WorkspaceUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update a workspace"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    if workspace.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update workspace
    update_data = workspace_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workspace, key, value)
    
    workspace.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(workspace)
    
    logger.info(f"Workspace updated: {workspace.name} (id={workspace.id})")
    
    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        description=workspace.description,
        plan=workspace.plan,
        credits=workspace.credits,
        max_agents=workspace.max_agents,
        max_parallel_agents=workspace.max_parallel_agents,
        max_tasks=workspace.max_tasks,
        max_concurrent_tasks=workspace.max_concurrent_tasks,
        max_automations=workspace.max_automations,
        max_scheduled_automations=workspace.max_scheduled_automations,
        max_workflows=workspace.max_workflows,
        max_saved_workflows=workspace.max_saved_workflows,
        max_task_runtime_minutes=workspace.max_task_runtime_minutes,
        web_research_limit=workspace.web_research_limit,
        file_analysis_limit_mb=workspace.file_analysis_limit_mb,
        token_budget=workspace.token_budget,
        theme=workspace.theme,
        layout=workspace.layout,
        master_ai_model=workspace.master_ai_model,
        default_provider=workspace.default_provider,
        strategy=workspace.strategy,
        escalation_policy=workspace.escalation_policy,
        heartbeat_interval=workspace.heartbeat_interval,
        memory_scope=workspace.memory_scope,
        notifications=workspace.notifications,
        user_id=str(workspace.user_id),
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        is_free_plan=workspace.is_free_plan,
        can_create_agents=workspace.can_create_agents,
        can_run_parallel=workspace.can_run_parallel,
    )


# ============================================
# DELETE WORKSPACE
# ============================================

@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a workspace"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    if workspace.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await db.delete(workspace)
    await db.commit()
    
    logger.info(f"Workspace deleted: {workspace.name} (id={workspace.id})")


# ============================================
# WORKSPACE SETTINGS
# ============================================

@router.get("/{workspace_id}/settings", response_model=WorkspaceSettings)
async def get_workspace_settings(
    workspace_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get workspace settings"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    if workspace.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return workspace.to_settings_dict()


# ============================================
# WORKSPACE STATS
# ============================================

@router.get("/{workspace_id}/stats", response_model=WorkspaceStats)
async def get_workspace_stats(
    workspace_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get workspace statistics"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    if workspace.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Get counts
    result = await db.execute(
        select(func.count()).where(Agent.workspace_id == workspace_id)
    )
    total_agents = result.scalar_one()
    
    result = await db.execute(
        select(func.count()).where(Task.workspace_id == workspace_id)
    )
    total_tasks = result.scalar_one()
    
    result = await db.execute(
        select(func.count()).where(
            Task.workspace_id == workspace_id,
            Task.status == "in_progress"
        )
    )
    active_tasks = result.scalar_one()
    
    result = await db.execute(
        select(func.count()).where(
            Task.workspace_id == workspace_id,
            Task.status == "completed"
        )
    )
    completed_tasks = result.scalar_one()
    
    result = await db.execute(
        select(func.count()).where(Skill.workspace_id == workspace_id)
    )
    total_skills = result.scalar_one()
    
    result = await db.execute(
        select(func.count()).where(Mission.workspace_id == workspace_id)
    )
    total_missions = result.scalar_one()
    
    # Get token usage
    from ..models.token_usage import TokenUsage
    result = await db.execute(
        select(TokenUsage.tokens_used).where(TokenUsage.workspace_id == workspace_id)
    )
    token_usage = sum(row.tokens_used for row in result.scalars().all())
    
    result = await db.execute(
        select(TokenUsage.cost).where(TokenUsage.workspace_id == workspace_id)
    )
    cost = sum(row.cost for row in result.scalars().all())
    
    return WorkspaceStats(
        workspace_id=str(workspace.id),
        total_agents=total_agents,
        total_tasks=total_tasks,
        total_skills=total_skills,
        total_missions=total_missions,
        active_tasks=active_tasks,
        completed_tasks=completed_tasks,
        token_usage=token_usage,
        cost=cost,
    )
