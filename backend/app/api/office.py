"""
Office API Router
Handles real-time office state and WebSocket connections
"""

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
import logging
import json
from datetime import datetime

from ..models.agent import Agent
from ..models.workspace import Workspace
from ..models.user import User
from ..schemas.office import OfficeState, OfficeStateResponse, OfficeConfig, OfficeUpdate, AgentStatusUpdate
from ..services.auth import auth_service
from ..services.orchestration import orchestration_service
from ..config.database import get_db
from ..config.websocket import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/office", tags=["office"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# GET OFFICE STATE
# ============================================

@router.get("/state", response_model=OfficeStateResponse)
async def get_office_state(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
):
    """Get the current state of the office"""
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
    
    # Get workspace
    if workspace_id:
        result = await db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        workspace = result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        
        # Check permissions
        if workspace.user_id != user_id and not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    else:
        # Get default workspace
        result = await db.execute(
            select(Workspace).where(Workspace.user_id == user_id).limit(1)
        )
        workspace = result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No workspace found"
            )
        
        workspace_id = str(workspace.id)
    
    # Get office state from orchestration service
    office_state = await orchestration_service.get_office_state(workspace_id)
    
    return OfficeStateResponse(
        agents=office_state.get("agents", []),
        theme=office_state.get("theme", "pixel"),
        layout=office_state.get("layout"),
        last_updated=office_state.get("last_updated"),
    )


# ============================================
# UPDATE OFFICE CONFIG
# ============================================

@router.put("/config", response_model=OfficeConfig)
async def update_office_config(
    config: OfficeConfig,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
):
    """Update office configuration"""
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
    
    # Get workspace
    if workspace_id:
        result = await db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        workspace = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(Workspace).where(Workspace.user_id == user_id).limit(1)
        )
        workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if workspace.user_id != user_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update workspace settings
    if config.theme:
        workspace.theme = config.theme
    if config.layout:
        workspace.layout = config.layout
    
    workspace.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(workspace)
    
    logger.info(f"Office config updated for workspace {workspace_id}")
    
    return OfficeConfig(
        theme=workspace.theme or "pixel",
        layout=workspace.layout or {},
        show_decorations=True,
        show_activity_feed=True,
        show_global_progress=True,
        cell_size=config.cell_size or 40,
    )


# ============================================
# WEBSOCKET ENDPOINT FOR OFFICE
# ============================================

@router.websocket("/ws")
async def websocket_office_endpoint(
    websocket: WebSocket,
    token: str,
    workspace_id: Optional[str] = None,
):
    """WebSocket endpoint for real-time office updates"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    user_id = payload.get("sub")
    
    # Get user
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Get workspace
        if workspace_id:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            workspace = result.scalar_one_or_none()
            
            if not workspace:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            # Check permissions
            if workspace.user_id != user_id and not user.is_admin:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        else:
            # Get default workspace
            result = await db.execute(
                select(Workspace).where(Workspace.user_id == user_id).limit(1)
            )
            workspace = result.scalar_one_or_none()
            
            if not workspace:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            workspace_id = str(workspace.id)
    
    # Accept connection
    await websocket_manager.connect(websocket, workspace_id, "office")
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                # Handle message types
                if message.get("type") == "subscribe":
                    await websocket_manager.subscribe(websocket, workspace_id)
                
                elif message.get("type") == "unsubscribe":
                    await websocket_manager.unsubscribe(websocket, workspace_id)
                
                elif message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                    }))
                
                # Broadcast to workspace
                await websocket_manager.broadcast(message, workspace_id)
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                }))
            
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket_manager.disconnect(websocket)


# ============================================
# UPDATE AGENT STATUS (for WebSocket)
# ============================================

@router.post("/agent-status", response_model=dict)
async def update_agent_status(
    update: AgentStatusUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update agent status (used by WebSocket clients)"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == update.agent_id)
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
    if update.status:
        agent.status = AgentStatus(update.status)
    if update.progress is not None:
        agent.progress = update.progress
    if update.current_task:
        agent.current_task = update.current_task
    
    agent.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(agent)
    
    # Broadcast update to WebSocket clients
    office_state = await orchestration_service.get_office_state(agent.workspace_id)
    await websocket_manager.send_to_workspace(
        agent.workspace_id,
        {
            "type": "office.update",
            "data": office_state,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    
    logger.info(f"Agent status updated: {update.agent_id}")
    
    return {
        "status": "updated",
        "agent_id": update.agent_id,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================
# HEARTBEAT ENDPOINT
# ============================================

@router.post("/heartbeat", response_model=dict)
async def office_heartbeat(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Send heartbeat to update office state"""
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
    
    # Get all workspaces for user
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id)
    )
    workspaces = result.scalars().all()
    
    # Send office state for each workspace
    for workspace in workspaces:
        office_state = await orchestration_service.get_office_state(str(workspace.id))
        await websocket_manager.send_to_workspace(
            str(workspace.id),
            {
                "type": "office.heartbeat",
                "data": office_state,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
    
    return {
        "status": "ok",
        "workspaces_updated": len(workspaces),
        "timestamp": datetime.utcnow().isoformat(),
    }
