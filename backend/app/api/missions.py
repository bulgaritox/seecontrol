"""
Missions API Router
Handles CRUD operations for missions (bounties)
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select, count
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
import logging

from ..models.mission import Mission, MissionStatus, MissionDifficulty
from ..models.user import User
from ..models.workspace import Workspace
from ..models.agent import Agent, AgentStatus
from ..schemas.mission import (
    MissionCreate, 
    MissionUpdate, 
    MissionResponse, 
    MissionListResponse,
    MissionCard,
    MissionAccept
)
from ..services.auth import auth_service
from ..services.orchestration import orchestration_service
from ..config.database import get_db
from ..config.websocket import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/missions", tags=["missions"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST MISSIONS
# ============================================

@router.get("/", response_model=MissionListResponse)
async def list_missions(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    status: Optional[MissionStatus] = None,
    difficulty: Optional[MissionDifficulty] = None,
    page: int = 1,
    page_size: int = 50,
):
    """List all missions with optional filtering"""
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
    query = select(Mission)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Mission.workspace_id == workspace_id)
    else:
        # Only show missions from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = [row.id for row in result.scalars().all()]
        if workspace_ids:
            query = query.where(Mission.workspace_id.in_(workspace_ids))
    
    # Filter by status
    if status:
        query = query.where(Mission.status == status)
    
    # Filter by difficulty
    if difficulty:
        query = query.where(Mission.difficulty == difficulty)
    
    # Order by created_at descending
    query = query.order_by(desc(Mission.created_at))
    
    # Get total count
    count_query = select(count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    missions = result.scalars().all()
    
    return MissionListResponse(
        missions=[
            MissionResponse(
                id=str(m.id),
                title=m.title,
                description=m.description,
                difficulty=m.difficulty,
                reward=m.reward,
                reward_currency=m.reward_currency,
                required_skills=m.required_skills,
                required_agents=m.required_agents,
                status=m.status,
                progress=m.progress,
                agent_team=m.agent_team,
                assigned_agent_ids=m.assigned_agent_ids,
                deadline=m.deadline,
                delivered_at=m.delivered_at,
                delivered_by=m.delivered_by,
                delivery_notes=m.delivery_notes,
                result=m.result,
                result_data=m.result_data,
                feedback=m.feedback,
                rating=m.rating,
                auto_accept=m.auto_accept,
                user_id=str(m.user_id),
                workspace_id=str(m.workspace_id),
                created_at=m.created_at,
                updated_at=m.updated_at,
                tags=m.tags,
                is_open=m.is_open,
                is_in_progress=m.is_in_progress,
                is_completed=m.is_completed,
                is_expired=m.is_expired,
            )
            for m in missions
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# GET MISSION
# ============================================

@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific mission by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get mission
    result = await db.execute(
        select(Mission).where(Mission.id == mission_id)
    )
    mission = result.scalar_one_or_none()
    
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == mission.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return MissionResponse(
        id=str(mission.id),
        title=mission.title,
        description=mission.description,
        difficulty=mission.difficulty,
        reward=mission.reward,
        reward_currency=mission.reward_currency,
        required_skills=mission.required_skills,
        required_agents=mission.required_agents,
        status=mission.status,
        progress=mission.progress,
        agent_team=mission.agent_team,
        assigned_agent_ids=mission.assigned_agent_ids,
        deadline=mission.deadline,
        delivered_at=mission.delivered_at,
        delivered_by=mission.delivered_by,
        delivery_notes=mission.delivery_notes,
        result=mission.result,
        result_data=mission.result_data,
        feedback=mission.feedback,
        rating=mission.rating,
        auto_accept=mission.auto_accept,
        user_id=str(mission.user_id),
        workspace_id=str(mission.workspace_id),
        created_at=mission.created_at,
        updated_at=mission.updated_at,
        tags=mission.tags,
        is_open=mission.is_open,
        is_in_progress=mission.is_in_progress,
        is_completed=mission.is_completed,
        is_expired=mission.is_expired,
    )


# ============================================
# CREATE MISSION
# ============================================

@router.post("/", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    mission_data: MissionCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new mission"""
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
    
    # Create mission
    mission = Mission(
        title=mission_data.title,
        description=mission_data.description,
        difficulty=mission_data.difficulty,
        reward=mission_data.reward,
        reward_currency=mission_data.reward_currency,
        required_skills=mission_data.required_skills,
        required_agents=mission_data.required_agents,
        agent_team=mission_data.agent_team,
        assigned_agent_ids=mission_data.assigned_agent_ids,
        deadline=mission_data.deadline,
        auto_accept=mission_data.auto_accept,
        tags=mission_data.tags,
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(mission)
    await db.commit()
    await db.refresh(mission)
    
    logger.info(f"Mission created: {mission.title} (id={mission.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_mission_update(mission)
    
    return MissionResponse(
        id=str(mission.id),
        title=mission.title,
        description=mission.description,
        difficulty=mission.difficulty,
        reward=mission.reward,
        reward_currency=mission.reward_currency,
        required_skills=mission.required_skills,
        required_agents=mission.required_agents,
        status=mission.status,
        progress=mission.progress,
        agent_team=mission.agent_team,
        assigned_agent_ids=mission.assigned_agent_ids,
        deadline=mission.deadline,
        delivered_at=mission.delivered_at,
        delivered_by=mission.delivered_by,
        delivery_notes=mission.delivery_notes,
        result=mission.result,
        result_data=mission.result_data,
        feedback=mission.feedback,
        rating=mission.rating,
        auto_accept=mission.auto_accept,
        user_id=str(mission.user_id),
        workspace_id=str(mission.workspace_id),
        created_at=mission.created_at,
        updated_at=mission.updated_at,
        tags=mission.tags,
        is_open=mission.is_open,
        is_in_progress=mission.is_in_progress,
        is_completed=mission.is_completed,
        is_expired=mission.is_expired,
    )


# ============================================
# UPDATE MISSION
# ============================================

@router.patch("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: str,
    mission_data: MissionUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update a mission"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get mission
    result = await db.execute(
        select(Mission).where(Mission.id == mission_id)
    )
    mission = result.scalar_one_or_none()
    
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == mission.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update mission
    update_data = mission_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mission, key, value)
    
    mission.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(mission)
    
    logger.info(f"Mission updated: {mission.title} (id={mission.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_mission_update(mission)
    
    return MissionResponse(
        id=str(mission.id),
        title=mission.title,
        description=mission.description,
        difficulty=mission.difficulty,
        reward=mission.reward,
        reward_currency=mission.reward_currency,
        required_skills=mission.required_skills,
        required_agents=mission.required_agents,
        status=mission.status,
        progress=mission.progress,
        agent_team=mission.agent_team,
        assigned_agent_ids=mission.assigned_agent_ids,
        deadline=mission.deadline,
        delivered_at=mission.delivered_at,
        delivered_by=mission.delivered_by,
        delivery_notes=mission.delivery_notes,
        result=mission.result,
        result_data=mission.result_data,
        feedback=mission.feedback,
        rating=mission.rating,
        auto_accept=mission.auto_accept,
        user_id=str(mission.user_id),
        workspace_id=str(mission.workspace_id),
        created_at=mission.created_at,
        updated_at=mission.updated_at,
        tags=mission.tags,
        is_open=mission.is_open,
        is_in_progress=mission.is_in_progress,
        is_completed=mission.is_completed,
        is_expired=mission.is_expired,
    )


# ============================================
# DELETE MISSION
# ============================================

@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mission_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a mission"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get mission
    result = await db.execute(
        select(Mission).where(Mission.id == mission_id)
    )
    mission = result.scalar_one_or_none()
    
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == mission.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await db.delete(mission)
    await db.commit()
    
    logger.info(f"Mission deleted: {mission.title} (id={mission.id})")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_mission_update(mission)


# ============================================
# ACCEPT MISSION
# ============================================

@router.post("/{mission_id}/accept", response_model=MissionResponse)
async def accept_mission(
    mission_id: str,
    accept_data: MissionAccept,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Accept a mission with specified agents"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get mission
    result = await db.execute(
        select(Mission).where(Mission.id == mission_id)
    )
    mission = result.scalar_one_or_none()
    
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == mission.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Check if mission can be accepted
    if mission.status != MissionStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mission is not open for acceptance"
        )
    
    # Verify agents exist and are available
    for agent_id in accept_data.agent_ids:
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.workspace_id == mission.workspace_id
            )
        )
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent {agent_id} not found"
            )
        
        if agent.status != AgentStatus.IDLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent {agent.name} is not available"
            )
    
    # Accept mission
    mission.status = MissionStatus.IN_PROGRESS
    mission.assigned_agent_ids = accept_data.agent_ids
    mission.agent_team = accept_data.agent_ids
    mission.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(mission)
    
    # Update agent statuses
    for agent_id in accept_data.agent_ids:
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if agent:
            agent.status = AgentStatus.WORKING
            agent.progress = 0.0
            agent.current_task = f"Mission: {mission.title}"
            await db.commit()
    
    logger.info(f"Mission accepted: {mission.title} (id={mission.id}) by agents {accept_data.agent_ids}")
    
    # Broadcast to WebSocket
    await websocket_manager.broadcast_mission_update(mission)
    await websocket_manager.broadcast_office_state(mission.workspace_id)
    
    return MissionResponse(
        id=str(mission.id),
        title=mission.title,
        description=mission.description,
        difficulty=mission.difficulty,
        reward=mission.reward,
        reward_currency=mission.reward_currency,
        required_skills=mission.required_skills,
        required_agents=mission.required_agents,
        status=mission.status,
        progress=mission.progress,
        agent_team=mission.agent_team,
        assigned_agent_ids=mission.assigned_agent_ids,
        deadline=mission.deadline,
        delivered_at=mission.delivered_at,
        delivered_by=mission.delivered_by,
        delivery_notes=mission.delivery_notes,
        result=mission.result,
        result_data=mission.result_data,
        feedback=mission.feedback,
        rating=mission.rating,
        auto_accept=mission.auto_accept,
        user_id=str(mission.user_id),
        workspace_id=str(mission.workspace_id),
        created_at=mission.created_at,
        updated_at=mission.updated_at,
        tags=mission.tags,
        is_open=mission.is_open,
        is_in_progress=mission.is_in_progress,
        is_completed=mission.is_completed,
        is_expired=mission.is_expired,
    )


# ============================================
# MISSION CENTER CARDS
# ============================================

@router.get("/center/cards", response_model=List[MissionCard])
async def get_mission_center_cards(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    status: Optional[MissionStatus] = None,
):
    """Get mission center cards (simplified mission data for display)"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Build query
    query = select(Mission)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Mission.workspace_id == workspace_id)
    else:
        # Only show missions from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = [row.id for row in result.scalars().all()]
        if workspace_ids:
            query = query.where(Mission.workspace_id.in_(workspace_ids))
    
    # Filter by status
    if status:
        query = query.where(Mission.status == status)
    
    # Order by created_at descending
    query = query.order_by(desc(Mission.created_at))
    
    result = await db.execute(query)
    missions = result.scalars().all()
    
    return [
        MissionCard(
            id=str(m.id),
            title=m.title,
            description=m.description,
            difficulty=m.difficulty.value,
            reward=m.reward,
            reward_currency=m.reward_currency,
            required_skills=m.required_skills,
            status=m.status.value,
            progress=int(m.progress),
            deadline=m.deadline,
        )
        for m in missions
    ]
